import { get, run } from "./db.js";
import { integ } from "./settings.js";

type Channel = "telegram" | "whatsapp" | "email";

export const channelStatus = () => ({
  telegram: Boolean(integ.tgToken() && integ.tgChat()),
  whatsapp: Boolean(integ.waToken() && integ.waPhoneId() && integ.waTo()),
  email: Boolean(integ.emailWebhook() && integ.emailTo()),
});

export type Targets = { tgChat?: string | null; waTo?: string | null; emailTo?: string | null };

/** Send a text alert to every configured channel (or to one user's own targets). Unconfigured channels are "simulated". */
export async function sendAlert(text: string, subject: string, only?: Channel, targets?: Targets): Promise<Record<Channel, string>> {
  const out: Record<string, string> = {};
  if (!only || only === "telegram") out.telegram = await telegram(text, targets?.tgChat).catch((e) => `error: ${e.message}`);
  if (!only || only === "whatsapp") out.whatsapp = await whatsapp(text, targets?.waTo).catch((e) => `error: ${e.message}`);
  if (!only || only === "email") out.email = await email(subject, text, targets?.emailTo).catch((e) => `error: ${e.message}`);
  return out as Record<Channel, string>;
}

/** Send to one member's own channels only (those they have set). */
export async function sendToUser(u: { tg_chat_id?: string | null; wa_to?: string | null; alert_email?: string | null }, text: string, subject: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (u.tg_chat_id) out.telegram = await telegram(text, u.tg_chat_id).catch((e) => `error: ${e.message}`);
  if (u.wa_to) out.whatsapp = await whatsapp(text, u.wa_to).catch((e) => `error: ${e.message}`);
  if (u.alert_email) out.email = await email(subject, text, u.alert_email).catch((e) => `error: ${e.message}`);
  return out;
}

/** Which transports the platform can use at all (bot token / WA account / email provider), regardless of recipients. */
export const transports = () => ({
  telegram: Boolean(integ.tgToken()), whatsapp: Boolean(integ.waToken() && integ.waPhoneId()), email: Boolean(integ.emailWebhook()),
});

let botUser: { username: string; at: number } | null = null;
/** Bot @username (cached 10 min) so members get a t.me deep link to connect. */
export async function telegramBotUsername(): Promise<string | null> {
  const token = integ.tgToken();
  if (!token) return null;
  if (botUser && Date.now() - botUser.at < 600_000) return botUser.username;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const j: any = await r.json();
    if (j?.ok) { botUser = { username: j.result.username, at: Date.now() }; return botUser.username; }
  } catch { /* offline */ }
  return null;
}

let tgOffset = 0;
/** Poll the bot for "/start <code>" messages and link that chat to the member who generated the code. */
export async function pollTelegramLinks(): Promise<number> {
  const token = integ.tgToken();
  if (!token) return 0;
  const pending = get("SELECT COUNT(*) c FROM tg_links WHERE created_at >= datetime('now','-1 day')").c;
  if (!pending) return 0;
  const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=0&offset=${tgOffset}&allowed_updates=["message"]`);
  const j: any = await r.json().catch(() => null);
  if (!j?.ok) return 0;
  let linked = 0;
  for (const u of j.result ?? []) {
    tgOffset = u.update_id + 1;
    const m = String(u.message?.text ?? "").match(/^\/start\s+([A-Za-z0-9]{6,})/);
    if (!m) continue;
    const row = get("SELECT user_id FROM tg_links WHERE code=?", m[1]);
    if (!row) continue;
    run("UPDATE users SET tg_chat_id=? WHERE id=?", String(u.message.chat.id), row.user_id);
    run("DELETE FROM tg_links WHERE code=?", m[1]);
    linked++;
    await telegram(`✅ Connected to <b>${integ.brandName()}</b>. You will receive trade alerts here.`, String(u.message.chat.id)).catch(() => {});
  }
  return linked;
}

async function telegram(text: string, to?: string | null): Promise<string> {
  const token = integ.tgToken(), chatId = to ?? integ.tgChat();
  if (!token || !chatId) return "simulated (Telegram not configured)";
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (r.ok) return "sent";
  const j: any = await r.json().catch(() => ({}));
  return `failed ${r.status}${j?.description ? `: ${j.description}` : ""}`;
}

async function whatsapp(text: string, toOverride?: string | null): Promise<string> {
  const token = integ.waToken(), phoneId = integ.waPhoneId(), to = (toOverride ?? integ.waTo()).replace(/[^0-9]/g, "");
  if (!token || !phoneId || !to) return "simulated (WhatsApp not configured)";
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text.replace(/<[^>]+>/g, "") } }),
  });
  if (r.ok) return "sent";
  const j: any = await r.json().catch(() => ({}));
  return `failed ${r.status}${j?.error?.message ? `: ${j.error.message}` : ""}`;
}

async function email(subject: string, text: string, toOverride?: string | null): Promise<string> {
  const url = integ.emailWebhook(), key = integ.emailKey(), from = integ.emailFrom(), to = toOverride ?? integ.emailTo();
  if (!url || !to) return "simulated (Email not configured)";
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ from, to: to.split(",").map((x) => x.trim()).filter(Boolean), subject, html: text.replace(/\n/g, "<br>") }),
  });
  return r.ok ? "sent" : `failed ${r.status}`;
}

/** Record which channels an alert went to (dedupe per trade+channel). */
export function recordAlert(tradeId: number, results: Record<string, string>) {
  const now = new Date().toISOString();
  for (const [channel, info] of Object.entries(results)) {
    try {
      run("INSERT OR IGNORE INTO alerts_sent(trade_id,channel,ok,info,created_at) VALUES(?,?,?,?,?)",
        tradeId, channel, info.startsWith("sent") ? 1 : 0, info, now);
    } catch { /* ignore */ }
  }
}

export const alreadyAlerted = (tradeId: number): boolean =>
  Boolean(get("SELECT 1 FROM alerts_sent WHERE trade_id=? LIMIT 1", tradeId));
