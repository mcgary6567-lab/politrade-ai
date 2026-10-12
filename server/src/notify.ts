import { config } from "./config.js";
import { get, run } from "./db.js";

type Channel = "telegram" | "whatsapp" | "email";

/** Send a text alert to every configured channel. Unconfigured channels are logged as "simulated". */
export async function sendAlert(text: string, subject: string): Promise<Record<Channel, string>> {
  const out: Record<string, string> = {};
  out.telegram = await telegram(text).catch((e) => `error: ${e.message}`);
  out.whatsapp = await whatsapp(text).catch((e) => `error: ${e.message}`);
  out.email = await email(subject, text).catch((e) => `error: ${e.message}`);
  return out as Record<Channel, string>;
}

async function telegram(text: string): Promise<string> {
  const { token, chatId } = config.telegram;
  if (!token || !chatId) return "simulated (no TELEGRAM_BOT_TOKEN/CHAT_ID)";
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  return r.ok ? "sent" : `failed ${r.status}`;
}

async function whatsapp(text: string): Promise<string> {
  const { token, phoneNumberId, to, graphVersion } = config.wa;
  if (!token || !phoneNumberId || !to) return "simulated (no WA_TOKEN/WA_PHONE_NUMBER_ID/WA_TO)";
  const r = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text.replace(/<[^>]+>/g, "") } }),
  });
  return r.ok ? "sent" : `failed ${r.status}`;
}

async function email(subject: string, text: string): Promise<string> {
  const { webhookUrl, apiKey, from, to } = config.email;
  if (!webhookUrl || !to) return "simulated (no EMAIL_WEBHOOK_URL/EMAIL_TO)";
  // Generic HTTP email provider (Resend-style). Point EMAIL_WEBHOOK_URL at your provider's send endpoint.
  const r = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()), subject, html: text.replace(/\n/g, "<br>") }),
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
