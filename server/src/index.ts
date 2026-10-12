import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import cron from "node-cron";
import { z } from "zod";
import { config, APP_VERSION } from "./config.js";
import { migrate, get, run, getSetting, setSetting } from "./db.js";
import { seedAdmin, login, requireAuth } from "./auth.js";
import { data } from "./routes/data.js";
import { alerts } from "./routes/alerts.js";
import { me } from "./routes/me.js";
import { admin } from "./routes/admin.js";
import { ingestFromFeed, stats, syncPoliticians } from "./ingest.js";
import { pollTelegramLinks } from "./notify.js";
import { seedDemo } from "./seed.js";
import { legalPage } from "./legal.js";
import { integ, aiOn } from "./settings.js";

export const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

migrate();
seedAdmin();
seedPlans();

app.get("/api/health", (_req, res) => res.json({ ok: true, version: APP_VERSION, ai: aiOn(), ...stats() }));
app.get("/api/branding", (_req, res) => res.json({
  name: integ.brandName(), version: APP_VERSION, contact: integ.contactEmail(),
  social: { x: integ.socialX(), telegram: integ.socialTelegram(), github: integ.socialGithub() },
}));

app.post("/api/auth/login", (req, res) => {
  const b = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: "Email and password required" });
  const r = login(b.data.email, b.data.password);
  if (!r) return res.status(401).json({ error: "Wrong email or password" });
  res.json(r);
});

// public legal pages
app.get("/privacy", (_req, res) => res.type("html").send(legalPage("privacy")));
app.get("/terms", (_req, res) => res.type("html").send(legalPage("terms")));
app.get("/disclaimer", (_req, res) => res.type("html").send(legalPage("disclaimer")));
app.get("/contact", (_req, res) => res.type("html").send(legalPage("contact")));

// everything below requires sign-in
const api = express.Router();
api.use(requireAuth);
api.use(me);
api.use(data);
api.use(alerts);
api.use(admin);
app.use("/api", api);

// serve the built web app in production
const webDist = path.resolve(config.webDist);
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

/** Default subscription plans: Free and Pro ($300 / year). Existing installs seeded with the old trio are migrated once. */
function seedPlans() {
  const now = new Date().toISOString();
  const FREE = "Browse every disclosed trade, politician and issuer\nLast 30 days of filings\n1 watchlist item";
  const PRO = "Full history since 2014 + every new filing\nInstant Telegram / WhatsApp / Email alerts\nUnlimited watchlist\nAI insight on every trade\nCSV export\nPriority support";
  if (!get("SELECT 1 FROM plans LIMIT 1")) {
    run("INSERT INTO plans(name,price_cents,interval,features,active,created_at) VALUES(?,?,?,?,1,?)", "Free", 0, "year", FREE, now);
    run("INSERT INTO plans(name,price_cents,interval,features,active,created_at) VALUES(?,?,?,?,1,?)", "Pro", 30000, "year", PRO, now);
    setSetting("plans.v2", "1");
    return;
  }
  if (getSetting("plans.v2")) return;
  // one-time: old defaults (Free $0/mo, Pro $19/mo, Team $49/mo) → Free + Pro $300/yr
  const pro = get("SELECT id FROM plans WHERE name='Pro' AND price_cents=1900 AND interval='month'");
  if (pro) run("UPDATE plans SET price_cents=30000, interval='year', features=? WHERE id=?", PRO, pro.id);
  const free = get("SELECT id FROM plans WHERE name='Free' AND price_cents=0");
  if (free) run("UPDATE plans SET interval='year', features=? WHERE id=?", FREE, free.id);
  const team = get("SELECT id FROM plans WHERE name='Team' AND price_cents=4900");
  if (team) { run("UPDATE users SET plan_id=? WHERE plan_id=?", pro?.id ?? null, team.id); run("DELETE FROM plans WHERE id=?", team.id); }
  setSetting("plans.v2", "1");
}

async function bootstrapData() {
  console.log("[ingest] empty database — fetching real disclosure data now…");
  try {
    const r = await ingestFromFeed({ alerts: false });
    console.log(`[ingest] first load: fetched ${r.fetched}, added ${r.added}${r.errors.length ? `, errors: ${r.errors.join(" | ")}` : ""}`);
    const s = await syncPoliticians();
    console.log(`[directory] ${s.matched} politicians matched, ${s.updated} updated`);
  } catch (e: any) { console.error("[ingest] first load failed:", e.message); }
}

/** Scheduler: re-reads the cron + feed URL from settings every minute so admin changes apply without a restart. */
function startScheduler() {
  let task: cron.ScheduledTask | null = null;
  let current = "";
  const sync = () => {
    const expr = integ.feedCron();
    const url = integ.feedUrl();
    const key = url ? expr : "";
    if (key === current) return;
    task?.stop(); task = null; current = key;
    if (!key || !cron.validate(expr)) { if (url) console.warn(`[ingest] invalid cron "${expr}"`); return; }
    task = cron.schedule(expr, () => {
      ingestFromFeed().then((r) => { console.log(`[ingest] fetched ${r.fetched}, added ${r.added}`); return r.added ? syncPoliticians() : null; }).catch((e) => console.error("[ingest]", e.message));
    });
    console.log(`[ingest] scheduled (${expr}) from ${url}`);
  };
  sync();
  setInterval(sync, 60_000).unref();
  setInterval(() => pollTelegramLinks().catch(() => 0), 20_000).unref();
}

if (process.env.NODE_ENV !== "test") {
  (async () => {
    if (config.demoData) await seedDemo();
    app.listen(config.port, () => {
      console.log(`${integ.brandName()} API on http://localhost:${config.port}  (AI: ${aiOn() ? "on" : "off"})`);
    });
    if (config.scheduler) startScheduler();
    // first boot with an empty database: pull the real disclosure data right away instead of waiting for the cron
    if (!get("SELECT 1 FROM trades LIMIT 1") && integ.feedUrls().length) bootstrapData();
  })();
}
