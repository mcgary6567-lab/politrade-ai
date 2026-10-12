import { getSetting, setSetting, all } from "./db.js";
import { config } from "./config.js";

/** A setting saved from the admin panel wins; otherwise fall back to the environment. */
export function s(key: string, fallback = ""): string {
  const v = getSetting(key);
  return v != null && v !== "" ? v : fallback;
}

/** Every integration value the app reads at runtime, resolved DB-first. */
export const integ = {
  anthropicKey: () => s("ai.anthropic_key", config.anthropicKey),
  geminiKey: () => s("ai.gemini_key", config.geminiKey),
  aiModel: () => s("ai.model", config.aiModel),
  geminiModel: () => s("ai.gemini_model", config.geminiModel),
  tgToken: () => s("tg.token", config.telegram.token),
  tgChat: () => s("tg.chat_id", config.telegram.chatId),
  waToken: () => s("wa.token", config.wa.token),
  waPhoneId: () => s("wa.phone_id", config.wa.phoneNumberId),
  waTo: () => s("wa.to", config.wa.to),
  emailWebhook: () => s("email.webhook_url", config.email.webhookUrl),
  emailKey: () => s("email.api_key", config.email.apiKey),
  emailFrom: () => s("email.from", config.email.from),
  emailTo: () => s("email.to", config.email.to),
  feedUrl: () => s("feed.url", config.dataFeedUrl),
  /** One or more feed URLs (newline/comma separated). `{KEY}` in a URL is replaced with the feed API key. */
  feedUrls: (): string[] => integ.feedUrl().split(/[\n,]+/).map((x) => x.trim()).filter(Boolean),
  feedApiKey: () => s("feed.api_key", ""),
  feedCron: () => s("feed.cron", config.ingestCron),
  polsSource: () => s("pols.source_url", "https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-current.json"),
  brandName: () => s("brand.name", config.brandName),
  contactEmail: () => s("brand.contact", config.contactEmail),
  socialX: () => s("social.x", config.social.x),
  socialTelegram: () => s("social.telegram", config.social.telegram),
  socialGithub: () => s("social.github", config.social.github),
  alertsEnabled: () => s("alerts.enabled", "1") === "1",
};

export const aiOn = () => Boolean(integ.anthropicKey() || integ.geminiKey());

/** Keys the admin panel may edit (and which ones are secrets, masked on read). */
export const SETTING_KEYS: { key: string; label: string; secret?: boolean; group: string }[] = [
  { key: "ai.anthropic_key", label: "Anthropic (Claude) API key", secret: true, group: "ai" },
  { key: "ai.gemini_key", label: "Google Gemini API key", secret: true, group: "ai" },
  { key: "ai.model", label: "Claude model", group: "ai" },
  { key: "tg.token", label: "Telegram bot token", secret: true, group: "telegram" },
  { key: "tg.chat_id", label: "Telegram chat / channel ID", group: "telegram" },
  { key: "wa.token", label: "WhatsApp Cloud API token", secret: true, group: "whatsapp" },
  { key: "wa.phone_id", label: "WhatsApp phone number ID", group: "whatsapp" },
  { key: "wa.to", label: "Send alerts to (number, e.g. 923001234567)", group: "whatsapp" },
  { key: "email.webhook_url", label: "Email provider send URL (e.g. https://api.resend.com/emails)", group: "email" },
  { key: "email.api_key", label: "Email provider API key", secret: true, group: "email" },
  { key: "email.from", label: "From address", group: "email" },
  { key: "email.to", label: "Send alerts to (comma-separated)", group: "email" },
  { key: "feed.url", label: "Data feed URL(s) — one per line", group: "feed" },
  { key: "feed.api_key", label: "Feed API key (replaces {KEY} in URLs)", secret: true, group: "feed" },
  { key: "feed.cron", label: "Ingest schedule (cron)", group: "feed" },
  { key: "pols.source_url", label: "Politicians directory source (JSON)", group: "feed" },
  { key: "alerts.enabled", label: "Alerts enabled (1/0)", group: "feed" },
  { key: "brand.name", label: "Brand name", group: "brand" },
  { key: "brand.contact", label: "Contact email", group: "brand" },
  { key: "social.x", label: "X / Twitter URL", group: "brand" },
  { key: "social.telegram", label: "Telegram URL", group: "brand" },
  { key: "social.github", label: "GitHub URL", group: "brand" },
];

const mask = (v: string) => (v.length <= 6 ? "••••" : v.slice(0, 3) + "••••" + v.slice(-3));

/** Settings for the admin UI: secrets masked, with a flag telling whether a value exists (DB or env). */
export function readSettingsForAdmin() {
  const saved = new Map(all("SELECT key, value FROM settings").map((r: any) => [r.key, r.value]));
  return SETTING_KEYS.map((k) => {
    const dbVal = (saved.get(k.key) as string) ?? "";
    const effective = s(k.key, envFallback(k.key));
    return { ...k, value: k.secret ? (effective ? mask(effective) : "") : effective, set: Boolean(effective), fromEnv: !dbVal && Boolean(effective) };
  });
}

function envFallback(key: string): string {
  const m: Record<string, string> = {
    "ai.anthropic_key": config.anthropicKey, "ai.gemini_key": config.geminiKey, "ai.model": config.aiModel,
    "tg.token": config.telegram.token, "tg.chat_id": config.telegram.chatId,
    "wa.token": config.wa.token, "wa.phone_id": config.wa.phoneNumberId, "wa.to": config.wa.to,
    "email.webhook_url": config.email.webhookUrl, "email.api_key": config.email.apiKey, "email.from": config.email.from, "email.to": config.email.to,
    "feed.url": config.dataFeedUrl, "feed.cron": config.ingestCron, "alerts.enabled": "1", "feed.api_key": "",
    "pols.source_url": "https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-current.json",
    "brand.name": config.brandName, "brand.contact": config.contactEmail,
    "social.x": config.social.x, "social.telegram": config.social.telegram, "social.github": config.social.github,
  };
  return m[key] ?? "";
}

export function writeSettings(values: Record<string, string>) {
  const allowed = new Set(SETTING_KEYS.map((k) => k.key));
  for (const [k, v] of Object.entries(values)) {
    if (!allowed.has(k)) continue;
    // a masked value echoed back from the UI means "unchanged"
    if (typeof v === "string" && v.includes("••••")) continue;
    setSetting(k, String(v ?? ""));
  }
}
