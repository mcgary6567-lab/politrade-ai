import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import cron from "node-cron";
import { z } from "zod";
import { config, APP_VERSION } from "./config.js";
import { migrate, get, all, run, getSetting, setSetting } from "./db.js";
import { seedAdmin, login, loginWithPin, signup, requireAuth } from "./auth.js";
import { data } from "./routes/data.js";
import { alerts } from "./routes/alerts.js";
import { me } from "./routes/me.js";
import { admin } from "./routes/admin.js";
import { ingestFromFeed, stats, syncPoliticians } from "./ingest.js";
import { pollTelegramLinks } from "./notify.js";
import { compress, photo, logo, bumpCache } from "./perf.js";
import { seedDemo } from "./seed.js";
import { backfillSectors } from "./sectors.js";
import { legalPage } from "./legal.js";
import { integ, aiOn } from "./settings.js";

export const app = express();
app.use(cors());
app.use(compress);
app.use(express.json({ limit: "5mb" }));

migrate();
seedAdmin();
seedPlans();
rebrandOnce();
backfillSectors(); // fill in company sectors from the curated ticker map (feed rarely carries them)

app.get("/api/photo/:bioguide", photo);
app.get("/api/logo/:ticker", logo);
app.get("/api/health", (_req, res) => res.json({ ok: true, version: APP_VERSION, ai: aiOn(), ...stats() }));
app.get("/api/branding", (_req, res) => res.json({
  name: integ.brandName(), version: APP_VERSION, contact: integ.contactEmail(),
  social: { x: integ.socialX(), telegram: integ.socialTelegram(), github: integ.socialGithub(), linkedin: integ.socialLinkedin() },
}));

app.post("/api/auth/login", (req, res) => {
  const b = z.object({ email: z.string().email(), password: z.string().min(1).optional(), pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits").optional() }).safeParse(req.body);
  if (!b.success || (!b.data.password && !b.data.pin)) return res.status(400).json({ error: "Email and password (or PIN) required" });
  if (b.data.pin) {
    const r = loginWithPin(b.data.email, b.data.pin);
    return "error" in r ? res.status(401).json(r) : res.json(r);
  }
  const r = login(b.data.email, b.data.password!);
  if (!r) return res.status(401).json({ error: "Wrong email or password" });
  res.json(r);
});
app.get("/api/auth/options", (_req, res) => res.json({ signup: integ.signupOpen(), brand: integ.brandName() }));
app.post("/api/auth/signup", (req, res) => {
  if (!integ.signupOpen()) return res.status(403).json({ error: "Sign-up is currently closed — contact us for an account" });
  const b = z.object({
    first_name: z.string().trim().min(1, "First name required").max(40), last_name: z.string().trim().min(1, "Last name required").max(40),
    email: z.string().email("Valid email required"), password: z.string().min(8, "Password must be at least 8 characters").max(100),
    accept: z.literal(true, { errorMap: () => ({ message: "Please accept the Terms and Privacy Policy" }) }),
  }).safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: b.error.issues[0]?.message ?? "Invalid input" });
  const r = signup(b.data);
  return "error" in r ? res.status(409).json(r) : res.json(r);
});

// public, read-only numbers for the marketing site on hillradar.com (no auth, CORS open, 10-minute cache)
let landingCache: { at: number; body: any } | null = null;
app.get("/api/public/landing", (_req, res) => {
  if (!landingCache || Date.now() - landingCache.at > 600_000) {
    const stats = get(`SELECT COUNT(*) trades, COUNT(DISTINCT politician_id) politicians, COUNT(DISTINCT issuer_id) issuers, MIN(tx_date) first_date, MAX(published_date) last_pub FROM trades`) ?? {};
    const latest = all(`SELECT tr.tx_type, tr.tx_date, tr.published_date, tr.amount_min, tr.amount_max, p.name politician, p.party, p.chamber, p.state, i.ticker, i.name issuer
      FROM trades tr JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id WHERE i.ticker IS NOT NULL ORDER BY tr.published_date DESC, tr.id DESC LIMIT 6`);
    const active = all(`SELECT p.name, p.party, p.chamber, p.state, COUNT(*) n FROM trades tr JOIN politicians p ON p.id=tr.politician_id WHERE tr.published_date >= date('now','-90 days') GROUP BY p.id ORDER BY n DESC LIMIT 6`);
    const popular = all(`SELECT i.ticker, i.name, COUNT(DISTINCT tr.politician_id) pols, COUNT(*) n FROM trades tr JOIN issuers i ON i.id=tr.issuer_id WHERE tr.published_date >= date('now','-90 days') AND i.ticker IS NOT NULL GROUP BY i.id ORDER BY pols DESC, n DESC LIMIT 6`);
    landingCache = { at: Date.now(), body: { brand: integ.brandName(), company: integ.companyName(), contact: integ.contactEmail(), stats, latest, active, popular } };
  }
  res.setHeader("cache-control", "public, max-age=300"); res.setHeader("access-control-allow-origin", "*");
  res.json(landingCache.body);
});

// public legal pages
app.get("/privacy", (_req, res) => res.type("html").send(legalPage("privacy")));
app.get("/terms", (_req, res) => res.type("html").send(legalPage("terms")));
app.get("/disclaimer", (_req, res) => res.type("html").send(legalPage("disclaimer")));
app.get("/contact", (_req, res) => res.type("html").send(legalPage("contact")));
app.get(["/faq", "/help"], (_req, res) => res.type("html").send(legalPage("faq")));

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
  // hashed assets are immutable; index.html must always be fresh so new deploys show up
  app.use(express.static(webDist, { maxAge: "365d", immutable: true, index: false, setHeaders: (res, p) => { if (p.endsWith(".html") || p.endsWith(".webmanifest") || p.endsWith("sw.js")) res.setHeader("cache-control", "no-cache"); } }));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html"), { headers: { "cache-control": "no-cache" } }));
}

/** One-time: installs that still carry the old default brand strings move to Hillradar. Custom values are left alone. */
function rebrandOnce() {
  if (getSetting("brand.v4")) return;
  const swap: Record<string, [string[], string]> = {
    "brand.name": [["PoliTrade AI", "Hillradar"], config.brandName], "brand.company": [["PoliTrade AI", "Hillradar"], config.brandName],
    "brand.contact": [["hello@politrade.ai", "hello@hillradar.com"], config.contactEmail],
    "email.from": [["alerts@politrade.ai"], config.email.from],
  };
  for (const [k, [olds, newV]] of Object.entries(swap)) { const cur = getSetting(k); if (cur != null && olds.includes(cur)) setSetting(k, newV); }
  setSetting("brand.v4", "1");
}

/** Default subscription plans: Free and Pro ($497 / year). Older installs are migrated once. */
function seedPlans() {
  const now = new Date().toISOString();
  const FREE = "Browse every disclosed trade, politician and issuer\nLast 30 days of filings\n1 watchlist item";
  const PRO = "Full history since 2014 + every new filing\nAI Scanning: every buy & sell signal with reasons and thesis\nInvestment Plan: back-test, calculator and full model portfolio\nInstant Telegram / WhatsApp / Email alerts\nUnlimited watchlist\nCSV export\nTrack-record leaderboard\nPriority support";
  if (!get("SELECT 1 FROM plans LIMIT 1")) {
    run("INSERT INTO plans(name,price_cents,interval,features,active,created_at) VALUES(?,?,?,?,1,?)", "Free", 0, "year", FREE, now);
    run("INSERT INTO plans(name,price_cents,interval,features,active,created_at) VALUES(?,?,?,?,1,?)", "Pro", 49700, "year", PRO, now);
    setSetting("plans.v2", "1"); setSetting("plans.v3", "1");
    return;
  }
  if (!getSetting("plans.v3")) {
    // one-time: Pro $300/yr → $497/yr with AI Scanning + Investment Plan in the feature list
    const p3 = get("SELECT id FROM plans WHERE name='Pro' AND price_cents=30000");
    if (p3) run("UPDATE plans SET price_cents=49700, features=? WHERE id=?", PRO, p3.id);
    setSetting("plans.v3", "1");
  }
  if (getSetting("plans.v2")) return;
  // one-time: old defaults (Free $0/mo, Pro $19/mo, Team $49/mo) → Free + Pro $300/yr
  const pro = get("SELECT id FROM plans WHERE name='Pro' AND price_cents=1900 AND interval='month'");
  if (pro) run("UPDATE plans SET price_cents=49700, interval='year', features=? WHERE id=?", PRO, pro.id);
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
    bumpCache();
    console.log(`[ingest] first load: fetched ${r.fetched}, added ${r.added}${r.errors.length ? `, errors: ${r.errors.join(" | ")}` : ""}`);
    const s = await syncPoliticians();
    console.log(`[directory] ${s.matched} politicians matched, ${s.updated} updated`);
    // first boot: record the current signals as already announced so members are not flooded with history
    const { checkSignalAlerts } = await import("./signals.js");
    const a = await checkSignalAlerts().catch((e) => { console.error("[signals]", e.message); return null; });
    if (a) console.log(`[signals] ${a.seeded ?? 0} recorded, ${a.announced.length} announced`);
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
      ingestFromFeed().then(async (r) => {
        console.log(`[ingest] fetched ${r.fetched}, added ${r.added}`);
        if (!r.added) return;
        bumpCache();
        await syncPoliticians().catch((e) => console.error("[directory]", e.message));
        const { checkSignalAlerts } = await import("./signals.js");
        const a = await checkSignalAlerts();
        if (a.announced.length) console.log(`[signals] announced: ${a.announced.map((x) => `${x.ticker} ${x.score}`).join(", ")}`);
      }).catch((e) => console.error("[ingest]", e.message));
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
