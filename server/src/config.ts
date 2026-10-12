import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

export const isProduction = process.env.NODE_ENV === "production";
const dbPath = process.env.DB_PATH ?? path.resolve("data/politrade.db");

function keptSecret(name: string, make: () => string): string {
  const file = path.join(path.dirname(dbPath), `.${name}`);
  try { const v = fs.readFileSync(file, "utf8").trim(); if (v) return v; } catch { /* first run */ }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const v = make();
  fs.writeFileSync(file, v + "\n", { mode: 0o600 });
  return v;
}

function jwtSecret(): string {
  const env = process.env.JWT_SECRET?.trim();
  if (env && env.length >= 16) return env;
  if (isProduction) return keptSecret("jwt_secret", () => crypto.randomBytes(32).toString("hex"));
  return "dev-secret-change-me";
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbPath,
  jwtSecret: jwtSecret(),
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:4000",
  webDist: process.env.WEB_DIST ?? "../web/dist",
  // who can sign in (the first admin is seeded from these on boot)
  adminEmail: (process.env.ADMIN_EMAIL ?? "admin@politrade.ai").toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? "politrade123",
  // data ingest
  dataFeedUrl: process.env.DATA_FEED_URL ?? "",          // public STOCK Act disclosure JSON feed
  ingestCron: process.env.INGEST_CRON ?? "0 */6 * * *",  // every 6 hours
  demoData: process.env.DEMO_DATA ? process.env.DEMO_DATA === "1" : !isProduction,
  // AI (optional)
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "claude-opus-5-5",
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
  // alert channels (all optional — unset channels are logged as "simulated")
  telegram: { token: process.env.TELEGRAM_BOT_TOKEN ?? "", chatId: process.env.TELEGRAM_CHAT_ID ?? "" },
  wa: { token: process.env.WA_TOKEN ?? "", phoneNumberId: process.env.WA_PHONE_NUMBER_ID ?? "", to: process.env.WA_TO ?? "", graphVersion: process.env.WA_GRAPH_VERSION ?? "v21.0" },
  email: {
    webhookUrl: process.env.EMAIL_WEBHOOK_URL ?? "",     // generic HTTP email provider (e.g. Resend/Mailgun REST)
    apiKey: process.env.EMAIL_API_KEY ?? "",
    from: process.env.EMAIL_FROM ?? "alerts@politrade.ai",
    to: process.env.EMAIL_TO ?? "",
  },
  scheduler: process.env.SCHEDULER !== "off",
  brandName: process.env.BRAND_NAME ?? "PoliTrade AI",
  contactEmail: process.env.CONTACT_EMAIL ?? "hello@politrade.ai",
  social: {
    x: process.env.SOCIAL_X ?? "",
    telegram: process.env.SOCIAL_TELEGRAM ?? "",
    github: process.env.SOCIAL_GITHUB ?? "",
  },
};

export const aiEnabled = () => Boolean(config.anthropicKey || config.geminiKey);
export const APP_VERSION = "1.0.0";
