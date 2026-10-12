import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { all, get, run } from "../db.js";
import { planOf } from "../auth.js";
import { sendToUser, telegramBotUsername, transports, pollTelegramLinks } from "../notify.js";
import { integ } from "../settings.js";

/** Signed-in member's own profile, password, alert channels and watchlist. */
export const me = Router();

const profile = (id: number) => {
  const u = get("SELECT id,email,name,role,plan_id,tg_chat_id,wa_to,alert_email,notify,created_at,last_login FROM users WHERE id=?", id);
  const plan = get("SELECT name, price_cents, interval, features FROM plans WHERE id=?", u.plan_id);
  return { ...u, ...planOf(u), planInfo: plan ?? null, tg_chat_id: u.tg_chat_id ? "connected" : null };
};

me.get("/me", async (req, res) => {
  res.json({ user: profile(req.user!.id), transports: transports(), bot: await telegramBotUsername(),
    alerts: all("SELECT a.channel,a.ok,a.info,a.created_at,tr.tx_type,p.name politician,i.ticker FROM user_alerts a JOIN trades tr ON tr.id=a.trade_id JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id WHERE a.user_id=? ORDER BY a.id DESC LIMIT 30", req.user!.id) });
});

me.put("/me", (req, res) => {
  const b = z.object({
    name: z.string().max(80).optional(), email: z.string().email().optional(),
    password: z.string().min(6).optional(), current_password: z.string().optional(),
    wa_to: z.string().max(30).nullable().optional(), alert_email: z.string().email().or(z.literal("")).nullable().optional(),
    notify: z.boolean().optional(), disconnect_telegram: z.boolean().optional(),
  }).safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: b.error.issues.map((i) => i.message).join(", ") });
  const v = b.data; const u = get("SELECT * FROM users WHERE id=?", req.user!.id);
  if (v.password || (v.email && v.email.toLowerCase() !== u.email)) {
    if (!v.current_password || !bcrypt.compareSync(v.current_password, u.password_hash)) return res.status(400).json({ error: "Current password is wrong" });
  }
  if (v.email && v.email.toLowerCase() !== u.email && get("SELECT 1 FROM users WHERE email=? AND id<>?", v.email.toLowerCase(), u.id)) return res.status(400).json({ error: "Email already in use" });
  run("UPDATE users SET name=?, email=?, wa_to=?, alert_email=?, notify=? WHERE id=?",
    v.name ?? u.name, (v.email ?? u.email).toLowerCase(),
    v.wa_to === undefined ? u.wa_to : (v.wa_to?.replace(/[^0-9]/g, "") || null),
    v.alert_email === undefined ? u.alert_email : (v.alert_email || null),
    v.notify === undefined ? u.notify : (v.notify ? 1 : 0), u.id);
  if (v.password) run("UPDATE users SET password_hash=? WHERE id=?", bcrypt.hashSync(v.password, 10), u.id);
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

/** Send a test message to the member's own channel(s). */
me.post("/me/test", async (req, res) => {
  const u = get("SELECT tg_chat_id, wa_to, alert_email FROM users WHERE id=?", req.user!.id);
  if (!u.tg_chat_id && !u.wa_to && !u.alert_email) return res.status(400).json({ error: "Add a channel first" });
  const brand = integ.brandName();
  res.json({ results: await sendToUser(u, `<b>${brand}</b> ✅ Test alert — your channel is connected.`, `${brand}: test alert`) });
});
