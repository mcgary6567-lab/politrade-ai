import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { all, get, run } from "../db.js";
import { planOf, hashPin } from "../auth.js";
import { sendToUser, telegramBotUsername, transports, pollTelegramLinks } from "../notify.js";
import { integ } from "../settings.js";

/** Signed-in member's own profile, password, alert channels and watchlist. */
export const me = Router();

const profile = (id: number) => {
  const u = get("SELECT id,email,name,first_name,last_name,role,plan_id,tg_chat_id,wa_to,alert_email,notify,notify_signals,created_at,last_login,(pin_hash IS NOT NULL) has_pin FROM users WHERE id=?", id);
  const plan = get("SELECT name, price_cents, interval, features FROM plans WHERE id=?", u.plan_id);
  return { ...u, ...planOf(u), planInfo: plan ?? null, tg_chat_id: u.tg_chat_id ? "connected" : null };
};

me.get("/me", async (req, res) => {
  res.json({ user: profile(req.user!.id), transports: transports(), bot: await telegramBotUsername(),
    alerts: all("SELECT a.channel,a.ok,a.info,a.created_at,tr.tx_type,p.name politician,i.ticker FROM user_alerts a JOIN trades tr ON tr.id=a.trade_id JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id WHERE a.user_id=? ORDER BY a.id DESC LIMIT 30", req.user!.id),
    signalAlerts: all("SELECT a.channel,a.ok,a.info,a.created_at,s.ticker,s.score,s.confidence FROM user_signal_alerts a JOIN signal_alerts s ON s.id=a.signal_id WHERE a.user_id=? ORDER BY a.id DESC LIMIT 30", req.user!.id) });
});

me.put("/me", (req, res) => {
  const b = z.object({
    name: z.string().max(80).optional(), first_name: z.string().max(40).optional(), last_name: z.string().max(40).optional(), email: z.string().email().optional(),
    pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits").or(z.literal("")).optional(),
    password: z.string().min(6).optional(), current_password: z.string().optional(),
    wa_to: z.string().max(30).nullable().optional(), alert_email: z.string().email().or(z.literal("")).nullable().optional(),
    notify: z.boolean().optional(), notify_signals: z.boolean().optional(), disconnect_telegram: z.boolean().optional(),
  }).safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: b.error.issues.map((i) => i.message).join(", ") });
  const v = b.data; const u = get("SELECT * FROM users WHERE id=?", req.user!.id);
  if (v.pin !== undefined && (!v.current_password || !bcrypt.compareSync(v.current_password, u.password_hash))) return res.status(400).json({ error: "Enter your current password to change the PIN" });
  if (v.pin && /^(\d)\1{3}$|^(0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)$/.test(v.pin)) return res.status(400).json({ error: "Choose a less obvious PIN" });
  if (v.password || (v.email && v.email.toLowerCase() !== u.email)) {
    if (!v.current_password || !bcrypt.compareSync(v.current_password, u.password_hash)) return res.status(400).json({ error: "Current password is wrong" });
  }
  if (v.email && v.email.toLowerCase() !== u.email && get("SELECT 1 FROM users WHERE email=? AND id<>?", v.email.toLowerCase(), u.id)) return res.status(400).json({ error: "Email already in use" });
  const first = v.first_name ?? u.first_name, last = v.last_name ?? u.last_name;
  const name = v.first_name !== undefined || v.last_name !== undefined ? `${first ?? ""} ${last ?? ""}`.trim() : (v.name ?? u.name);
  run("UPDATE users SET name=?, first_name=?, last_name=?, email=?, wa_to=?, alert_email=?, notify=?, notify_signals=? WHERE id=?",
    name, first ?? null, last ?? null, (v.email ?? u.email).toLowerCase(),
    v.wa_to === undefined ? u.wa_to : (v.wa_to?.replace(/[^0-9]/g, "") || null),
    v.alert_email === undefined ? u.alert_email : (v.alert_email || null),
    v.notify === undefined ? u.notify : (v.notify ? 1 : 0),
    v.notify_signals === undefined ? u.notify_signals : (v.notify_signals ? 1 : 0), u.id);
  if (v.password) run("UPDATE users SET password_hash=? WHERE id=?", bcrypt.hashSync(v.password, 10), u.id);
  if (v.pin !== undefined) run("UPDATE users SET pin_hash=?, pin_fails=0, pin_locked_until=NULL WHERE id=?", v.pin ? hashPin(v.pin) : null, u.id);
  if (v.disconnect_telegram) run("UPDATE users SET tg_chat_id=NULL WHERE id=?", u.id);
  res.json({ ok: true, user: profile(u.id) });
});

/** Start a Telegram link: member opens t.me/<bot>?start=<code>; the poller links the chat. */
me.post("/me/telegram/link", async (req, res) => {
  const bot = await telegramBotUsername();
  if (!bot) return res.status(400).json({ error: "Telegram alerts are not enabled on this server yet" });
  run("DELETE FROM tg_links WHERE user_id=?", req.user!.id);
  const code = crypto.randomBytes(5).toString("hex");
  run("INSERT INTO tg_links(code,user_id,created_at) VALUES(?,?,?)", code, req.user!.id, new Date().toISOString());
  res.json({ url: `https://t.me/${bot}?start=${code}`, code, bot });
});
/** Called by the UI while waiting: polls the bot once and reports whether this member is now linked. */
me.get("/me/telegram/status", async (req, res) => {
  await pollTelegramLinks().catch(() => 0);
  res.json({ linked: Boolean(get("SELECT tg_chat_id FROM users WHERE id=?", req.user!.id).tg_chat_id) });
});

/** Send the current #1 buy signal to the member's own channels, so they can see what a signal alert looks like. */
me.post("/me/test-signal", async (req, res) => {
  const u = get("SELECT tg_chat_id, wa_to, alert_email FROM users WHERE id=?", req.user!.id);
  if (!u.tg_chat_id && !u.wa_to && !u.alert_email) return res.status(400).json({ error: "Add a channel first" });
  const { computeSignals, withTheses, formatSignal } = await import("../signals.js");
  const top = computeSignals(90, 1).buy[0];
  if (!top) return res.status(400).json({ error: "No buy signal to send right now" });
  await withTheses([top], 1);
  const { text, subject } = formatSignal(top, "test");
  res.json({ results: await sendToUser(u, text, subject), ticker: top.ticker });
});

/** Send a test message to the member's own channel(s). */
me.post("/me/test", async (req, res) => {
  const u = get("SELECT tg_chat_id, wa_to, alert_email FROM users WHERE id=?", req.user!.id);
  if (!u.tg_chat_id && !u.wa_to && !u.alert_email) return res.status(400).json({ error: "Add a channel first" });
  const brand = integ.brandName();
  res.json({ results: await sendToUser(u, `<b>${brand}</b> ✅ Test alert — your channel is connected.`, `${brand}: test alert`) });
});
