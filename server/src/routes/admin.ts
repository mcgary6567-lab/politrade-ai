import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { all, get, run } from "../db.js";
import { config } from "../config.js";
import { readSettingsForAdmin, writeSettings, integ, aiOn } from "../settings.js";
import { channelStatus, sendAlert } from "../notify.js";
import { ingestFromFeed, ingestRows, fireAlert, stats, syncPoliticians } from "../ingest.js";
import { FEED_PRESETS } from "../sources.js";
import { bumpCache } from "../perf.js";
import { tradeInsight } from "../ai.js";

export const admin = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}
admin.use(requireAdmin);

const now = () => new Date().toISOString();
const wrap = (fn: (req: Request, res: Response) => Promise<any> | any) => async (req: Request, res: Response) => {
  try { await fn(req, res); } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: e.issues.map((i: any) => i.message).join(", ") });
    res.status(400).json({ error: e?.message ?? "Request failed" });
  }
};

/* ---------- overview ---------- */
admin.get("/admin/overview", (_req, res) => {
  res.json({
    ...stats(),
    users: get("SELECT COUNT(*) c FROM users").c,
    activeUsers: get("SELECT COUNT(*) c FROM users WHERE status='active'").c,
    plans: get("SELECT COUNT(*) c FROM plans WHERE active=1").c,
    alerts24h: get("SELECT COUNT(*) c FROM alerts_sent WHERE created_at >= datetime('now','-1 day')").c,
    alertsFailed: get("SELECT COUNT(*) c FROM alerts_sent WHERE ok=0").c,
    channels: channelStatus(),
    ai: aiOn(),
    feed: { url: integ.feedUrl(), cron: integ.feedCron(), enabled: integ.alertsEnabled(), scheduler: config.scheduler },
    lastIngest: get("SELECT * FROM ingest_log ORDER BY id DESC LIMIT 1") ?? null,
    recentUsers: all("SELECT id,email,name,role,status,last_login,created_at FROM users ORDER BY id DESC LIMIT 5"),
    version: config.publicUrl,
  });
});

/* ---------- users ---------- */
const userSchema = z.object({
  email: z.string().email(), password: z.string().min(6).optional(), name: z.string().max(80).optional(),
  role: z.enum(["admin", "member"]).default("member"), status: z.enum(["active", "suspended"]).default("active"),
  plan_id: z.number().int().nullable().optional(),
});

admin.get("/admin/users", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const role = String(req.query.role ?? ""), status = String(req.query.status ?? ""), plan = String(req.query.plan ?? "");
  const where: string[] = [], args: unknown[] = [];
  if (q) { where.push("(u.email LIKE ? OR u.name LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  if (role === "admin" || role === "member") { where.push("u.role=?"); args.push(role); }
  if (status === "active" || status === "suspended") { where.push("u.status=?"); args.push(status); }
  if (plan === "none") where.push("u.plan_id IS NULL");
  else if (plan === "paid") where.push("p.price_cents > 0 AND p.active=1");
  else if (/^\d+$/.test(plan)) { where.push("u.plan_id=?"); args.push(Number(plan)); }
  const rows = all(
    `SELECT u.id,u.email,u.name,u.role,u.status,u.plan_id,u.last_login,u.created_at, p.name plan,
            (p.price_cents > 0 AND p.active=1) paid,
            (SELECT COUNT(*) FROM watchlist w WHERE w.user_id=u.id) watch
     FROM users u LEFT JOIN plans p ON p.id=u.plan_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY u.id DESC`, ...args);
  const stats = get(
    `SELECT COUNT(*) total,
            SUM(u.role='admin') admins,
            SUM(u.status='suspended') suspended,
            SUM(p.price_cents > 0 AND p.active=1) paid,
            SUM(u.last_login >= datetime('now','-7 day')) active7d
     FROM users u LEFT JOIN plans p ON p.id=u.plan_id`);
  res.json({ rows, stats });
});

admin.post("/admin/users", wrap((req, res) => {
  const b = userSchema.extend({ password: z.string().min(6) }).parse(req.body);
  const email = b.email.toLowerCase();
  if (get("SELECT 1 FROM users WHERE email=?", email)) throw new Error("Email already exists");
  const id = run("INSERT INTO users(email,password_hash,name,role,status,plan_id,created_at) VALUES(?,?,?,?,?,?,?)",
    email, bcrypt.hashSync(b.password, 10), b.name ?? null, b.role, b.status, b.plan_id ?? null, now()).lastInsertRowid;
  res.json({ ok: true, id: Number(id) });
}));

admin.put("/admin/users/:id", wrap((req, res) => {
  const id = Number(req.params.id);
  const u = get("SELECT * FROM users WHERE id=?", id);
  if (!u) throw new Error("User not found");
  const b = userSchema.partial().parse(req.body);
  // never let the last admin demote/suspend themselves out of the panel
  const admins = get("SELECT COUNT(*) c FROM users WHERE role='admin' AND status='active'").c;
  const losingAdmin = u.role === "admin" && ((b.role && b.role !== "admin") || (b.status && b.status !== "active"));
  if (losingAdmin && admins <= 1) throw new Error("At least one active admin is required");
  const email = (b.email ?? u.email).toLowerCase();
  if (email !== u.email && get("SELECT 1 FROM users WHERE email=? AND id<>?", email, id)) throw new Error("Email already exists");
  run("UPDATE users SET email=?, name=?, role=?, status=?, plan_id=? WHERE id=?",
    email, b.name ?? u.name, b.role ?? u.role, b.status ?? u.status,
    b.plan_id === undefined ? u.plan_id : b.plan_id, id);
  if (b.password) run("UPDATE users SET password_hash=? WHERE id=?", bcrypt.hashSync(b.password, 10), id);
  res.json({ ok: true });
}));

admin.delete("/admin/users/:id", wrap((req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) throw new Error("You cannot delete your own account");
  run("DELETE FROM watchlist WHERE user_id=?", id);
  run("DELETE FROM users WHERE id=?", id);
  res.json({ ok: true });
}));

/* ---------- plans ---------- */
const planSchema = z.object({
  name: z.string().min(1).max(60), price_cents: z.number().int().min(0).default(0),
  interval: z.enum(["month", "year", "lifetime"]).default("month"),
  features: z.string().max(2000).optional(), active: z.boolean().default(true),
});
admin.get("/admin/plans", (_req, res) => {
  res.json({ rows: all("SELECT p.*, (SELECT COUNT(*) FROM users u WHERE u.plan_id=p.id) members FROM plans p ORDER BY p.price_cents, p.id") });
});
admin.post("/admin/plans", wrap((req, res) => {
  const b = planSchema.parse(req.body);
  const id = run("INSERT INTO plans(name,price_cents,interval,features,active,created_at) VALUES(?,?,?,?,?,?)",
    b.name, b.price_cents, b.interval, b.features ?? "", b.active ? 1 : 0, now()).lastInsertRowid;
  res.json({ ok: true, id: Number(id) });
}));
admin.put("/admin/plans/:id", wrap((req, res) => {
  const p = get("SELECT * FROM plans WHERE id=?", req.params.id);
  if (!p) throw new Error("Plan not found");
  const b = planSchema.partial().parse(req.body);
  run("UPDATE plans SET name=?, price_cents=?, interval=?, features=?, active=? WHERE id=?",
    b.name ?? p.name, b.price_cents ?? p.price_cents, b.interval ?? p.interval, b.features ?? p.features,
    b.active === undefined ? p.active : (b.active ? 1 : 0), p.id);
  res.json({ ok: true });
}));
admin.delete("/admin/plans/:id", wrap((req, res) => {
  run("UPDATE users SET plan_id=NULL WHERE plan_id=?", req.params.id);
  run("DELETE FROM plans WHERE id=?", req.params.id);
  res.json({ ok: true });
}));

/* ---------- settings / integrations ---------- */
admin.get("/admin/settings", (_req, res) => res.json({ rows: readSettingsForAdmin(), channels: channelStatus(), ai: aiOn() }));
admin.put("/admin/settings", wrap((req, res) => {
  const b = z.record(z.string(), z.string()).parse(req.body?.values ?? req.body);
  writeSettings(b);
  res.json({ ok: true, rows: readSettingsForAdmin(), channels: channelStatus(), ai: aiOn() });
}));

/** Verify the AI key works by generating one sample insight. (Registered before /test/:channel so it is not captured.) */
admin.post("/admin/test/ai", wrap(async (_req, res) => {
  if (!aiOn()) throw new Error("No AI key saved yet");
  const t0 = Date.now();
  const note = await tradeInsight({ politician: "Rep. Jordan Avery", party: "Democrat", chamber: "House", ticker: "NVDA", issuer: "NVIDIA Corp.", tx_type: "buy", amount_min: 15001, amount_max: 50000, tx_date: now().slice(0, 10) });
  res.json({ ok: true, note, ms: Date.now() - t0, provider: integ.anthropicKey() ? "claude" : "gemini" });
}));

/** Send a test message to one channel (or all), so the admin can verify keys right after saving. */
admin.post("/admin/test/:channel", wrap(async (req, res) => {
  const ch = req.params.channel;
  if (!["telegram", "whatsapp", "email", "all"].includes(ch)) throw new Error("Unknown channel");
  const brand = integ.brandName();
  const text = `<b>${brand}</b> ✅ Test alert from the admin panel at ${now().slice(0, 16).replace("T", " ")} UTC. Channels are wired correctly.`;
  const r = await sendAlert(text, `${brand}: test alert`, ch === "all" ? undefined : (ch as "telegram" | "whatsapp" | "email"));
  res.json({ ok: Object.values(r).every((v) => v.startsWith("sent")), results: r });
}));

/* ---------- data feed & alerts ---------- */
admin.post("/admin/ingest/run", wrap(async (_req, res) => {
  const r = await ingestFromFeed(); bumpCache();
  let signals: any = null;
  if (r.added) { const { checkSignalAlerts } = await import("../signals.js"); signals = await checkSignalAlerts().catch((e) => ({ error: e.message })); }
  res.json({ ...r, signals });
}));
/** Evaluate signals now; dry=1 only lists what would be announced. */
admin.post("/admin/signals/check", wrap(async (req, res) => {
  const { checkSignalAlerts } = await import("../signals.js");
  res.json(await checkSignalAlerts({ dryRun: String(req.query.dry ?? "") === "1", force: String(req.query.force ?? "") === "1" }));
}));
admin.get("/admin/signals/log", (_req, res) => res.json({
  rows: all(`SELECT s.id, s.ticker, s.direction, s.confidence, s.score, s.buyers, s.created_at,
                    SUM(a.ok) sent, COUNT(a.id) attempts
             FROM signal_alerts s LEFT JOIN user_signal_alerts a ON a.signal_id=s.id GROUP BY s.id ORDER BY s.id DESC LIMIT 50`),
}));
admin.get("/admin/ingest/presets", (_req, res) => res.json({ presets: FEED_PRESETS }));
/** Fill party / state / chamber / photo for our politicians from the public legislators directory. */
admin.post("/admin/politicians/sync", wrap(async (_req, res) => { const r = await syncPoliticians(); bumpCache(); res.json(r); }));
admin.post("/admin/ingest/import", wrap(async (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : req.body?.rows;
  if (!Array.isArray(rows)) throw new Error("Body must be a JSON array of trade records");
  const r = await ingestRows(rows.slice(0, 5000), "manual import"); bumpCache(); res.json(r);
}));
admin.get("/admin/ingest/log", (_req, res) => res.json({ rows: all("SELECT * FROM ingest_log ORDER BY id DESC LIMIT 50") }));
admin.get("/admin/alerts/log", (_req, res) => res.json({
  rows: all(`SELECT a.id,a.channel,a.ok,a.info,a.created_at,tr.id trade_id,tr.tx_type,p.name politician,i.ticker
             FROM alerts_sent a JOIN trades tr ON tr.id=a.trade_id JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id
             ORDER BY a.id DESC LIMIT 100`),
}));
/** Re-send the alert for one trade (useful after fixing a channel). */
admin.post("/admin/alerts/resend/:tradeId", wrap(async (req, res) => {
  const id = Number(req.params.tradeId);
  if (!get("SELECT 1 FROM trades WHERE id=?", id)) throw new Error("Trade not found");
  run("DELETE FROM alerts_sent WHERE trade_id=?", id);
  res.json(await fireAlert(id));
}));

/* ---------- data management ---------- */
admin.delete("/admin/trades/:id", wrap((req, res) => {
  run("DELETE FROM alerts_sent WHERE trade_id=?", req.params.id);
  run("DELETE FROM trades WHERE id=?", req.params.id);
  res.json({ ok: true });
}));
admin.put("/admin/politicians/:id", wrap((req, res) => {
  const b = z.object({ name: z.string().min(1).optional(), party: z.string().optional(), chamber: z.string().optional(), state: z.string().optional(), photo_url: z.string().optional() }).parse(req.body);
  const p = get("SELECT * FROM politicians WHERE id=?", req.params.id);
  if (!p) throw new Error("Not found");
  run("UPDATE politicians SET name=?, party=?, chamber=?, state=?, photo_url=? WHERE id=?",
    b.name ?? p.name, b.party ?? p.party, b.chamber ?? p.chamber, b.state ?? p.state, b.photo_url ?? p.photo_url, p.id);
  res.json({ ok: true });
}));
admin.put("/admin/issuers/:id", wrap((req, res) => {
  const b = z.object({ name: z.string().min(1).optional(), ticker: z.string().optional(), sector: z.string().optional() }).parse(req.body);
  const i = get("SELECT * FROM issuers WHERE id=?", req.params.id);
  if (!i) throw new Error("Not found");
  run("UPDATE issuers SET name=?, ticker=?, sector=? WHERE id=?", b.name ?? i.name, b.ticker?.toUpperCase() ?? i.ticker, b.sector ?? i.sector, i.id);
  res.json({ ok: true });
}));
/** Wipe the fictional demo trades once real data is flowing. */
admin.post("/admin/demo/clear", wrap((_req, res) => {
  run("DELETE FROM alerts_sent WHERE trade_id IN (SELECT id FROM trades WHERE raw_id LIKE 'demo-%')");
  const r = run("DELETE FROM trades WHERE raw_id LIKE 'demo-%'");
  run("DELETE FROM politicians WHERE id NOT IN (SELECT DISTINCT politician_id FROM trades)");
  run("DELETE FROM issuers WHERE id NOT IN (SELECT DISTINCT issuer_id FROM trades)");
  bumpCache();
  res.json({ ok: true, removed: Number(r.changes) });
}));
