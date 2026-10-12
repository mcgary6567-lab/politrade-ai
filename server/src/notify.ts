import { get, run } from "./db.js";
import { integ } from "./settings.js";

type Channel = "telegram" | "whatsapp" | "email";

export const channelStatus = () => ({
  telegram: Boolean(integ.tgToken() && integ.tgChat()),
  whatsapp: Boolean(integ.waToken() && integ.waPhoneId() && integ.waTo()),
  email: Boolean(integ.emailWebhook() && integ.emailTo()),
});

/** Send a text alert to every configured channel. Unconfigured channels are logged as "simulated". */
export async function sendAlert(text: string, subject: string, only?: Channel): Promise<Record<Channel, string>> {
  const out: Record<string, string> = {};
  if (!only || only === "telegram") out.telegram = await telegram(text).catch((e) => `error: ${e.message}`);
  if (!only || only === "whatsapp") out.whatsapp = await whatsapp(text).catch((e) => `error: ${e.message}`);
  if (!only || only === "email") out.email = await email(subject, text).catch((e) => `error: ${e.message}`);
  return out as Record<Channel, string>;
}

async function telegram(text: string): Promise<string> {
  const token = integ.tgToken(), chatId = integ.tgChat();
  if (!token || !chatId) return "simulated (Telegram not configured)";
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (r.ok) return "sent";
  const j: any = await r.json().catch(() => ({}));
  return `failed ${r.status}${j?.description ? `: ${j.description}` : ""}`;
}

async function whatsapp(text: string): Promise<string> {
  const token = integ.waToken(), phoneId = integ.waPhoneId(), to = integ.waTo();
  if (!token || !phoneId || !to) return "simulated (WhatsApp not configured)";
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text.replace(/<[^>]+>/g, "") } }),
  });
  if (r.ok) return "sent";
  const j: any = await r.json().catch(() => ({}));
  return `failed ${r.status}${j?.error?.message ? `: ${j.error.message}` : ""}`;
}

async function email(subject: string, text: string): Promise<string> {
  const url = integ.emailWebhook(), key = integ.emailKey(), from = integ.emailFrom(), to = integ.emailTo();
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
