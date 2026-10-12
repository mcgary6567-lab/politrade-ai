import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import cron from "node-cron";
import { z } from "zod";
import { config, APP_VERSION } from "./config.js";
import { migrate, get, run } from "./db.js";
import { seedAdmin, login, requireAuth } from "./auth.js";
import { data } from "./routes/data.js";
import { alerts } from "./routes/alerts.js";
import { admin } from "./routes/admin.js";
import { ingestFromFeed, stats } from "./ingest.js";
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
api.get("/me", (req, res) => res.json({ user: req.user }));
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

/** Default subscription plans so the admin panel is not empty on first boot. */
function seedPlans() {
  if (get("SELECT 1 FROM plans LIMIT 1")) return;
  const now = new Date().toISOString();
  const rows: [string, number, string, string][] = [
    ["Free", 0, "month", "Browse trades, politicians, issuers\nDaily digest\n1 watchlist item"],
    ["Pro", 1900, "month", "Everything in Free\nInstant Telegram / WhatsApp / Email alerts\nUnlimited watchlist\nAI insight on every trade"],
    ["Team", 4900, "month", "Everything in Pro\n5 seats\nCSV / API access\nPriority support"],
  ];
  for (const [name, price, interval, features] of rows)
    run("INSERT INTO plans(name,price_cents,interval,features,active,created_at) VALUES(?,?,?,?,1,?)", name, price, interval, features, now);
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
      ingestFromFeed().then((r) => console.log(`[ingest] fetched ${r.fetched}, added ${r.added}`)).catch((e) => console.error("[ingest]", e.message));
    });
    console.log(`[ingest] scheduled (${expr}) from ${url}`);
  };
  sync();
  setInterval(sync, 60_000).unref();
}

if (process.env.NODE_ENV !== "test") {
  (async () => {
    if (config.demoData) await seedDemo();
    app.listen(config.port, () => {
      console.log(`${integ.brandName()} API on http://localhost:${config.port}  (AI: ${aiOn() ? "on" : "off"})`);
    });
    if (config.scheduler) startScheduler();
  })();
}
