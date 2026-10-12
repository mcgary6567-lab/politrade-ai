# PoliTrade AI

Track **publicly disclosed US congressional stock trades** (STOCK Act disclosures) with **AI-powered alerts** to WhatsApp, Telegram and email the moment a lawmaker files a trade.

Built with the same stack as a production app: **Node.js 22 + TypeScript + Express + SQLite (node:sqlite)** on the backend, **React 18 + Vite + Tailwind CSS** on the frontend. One Docker image, one always-on machine, one SQLite file.

> ⚠️ **Disclaimer:** For research and educational use only — not financial advice. Data comes from public government disclosures and may be delayed or contain errors. Not affiliated with any government body, lawmaker, or company.

## Features
- **Login-gated app** — a dashboard home, then four focused pages.
- **Trades** — filterable, paginated feed (type, party, chamber, ticker, search).
- **Politicians** — lawmakers ranked by activity, with per-politician trade history.
- **Issuers** — companies most traded by members of Congress.
- **Insights** — charts: trades per month, party split, top issuers, sectors, buy/sell ratio.
- **AI automation** — when a new trade is ingested, an AI one-line summary is generated and **pushed to every connected channel** (Telegram / WhatsApp / email). Unconfigured channels are logged as "simulated" so the app always works.
- **Footer** — Terms & Conditions, Disclaimer, Privacy Policy, Contact Us, social links.

## Admin panel (`/admin`, admin role only)
Everything is controlled from the browser — no redeploy or secrets needed after first boot:
- **Overview** — users, plans, trades, alerts, channel status, last ingest.
- **Users** — add / edit / suspend / delete members, reset passwords, assign a plan, admin or member role. Suspended users are cut off immediately.
- **Plans** — payment plans (name, price, monthly / yearly / lifetime, feature list, visible flag).
- **Integrations** — AI keys (Claude or Gemini), Telegram bot, WhatsApp Cloud API, email provider, branding & social links. Each has a **Test** button; secrets are stored masked.
- **Data feed** — feed URL, cron schedule, alerts on/off, **Run now**, manual JSON import, ingest history, **Clear demo data**.
- **Alerts log** — every delivery per channel with the provider's error text and a re-send button.

Values saved in the panel override the environment variables below (`settings` table), and the scheduler picks up changes within a minute.

## Data
The app ingests from a **configurable public feed** (Admin → Data feed, or `DATA_FEED_URL`) of congressional disclosures (STOCK Act). It accepts a JSON array (or `{transactions:[…]}`) and auto-detects common field names (`representative`/`senator`, `ticker`, `asset_description`, `type`, `amount`, `transaction_date`, `disclosure_date`, `party`, `state`, `owner`). It ships with **demo sample data** (fictional sample politicians — we never attach fabricated trades to real people) so it runs out of the box; once real data flows, press **Clear demo data**.

Filters: trades by type, party, chamber, state, sector, owner, amount band, trade-date range, recency and sort (newest, largest, slowest filers) with CSV export; politicians by party / chamber / state; issuers by sector; insights by time window.

## Run locally
```bash
# backend
cd server && npm install
DEMO_DATA=1 npm run dev           # API on :4000

# frontend (another terminal)
cd web && npm install && npm run dev   # Vite on :5173
```
Sign in with `admin@politrade.ai` / `politrade123` (override via `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## Deploy (Fly.io)
```bash
fly apps create politrade-ai
fly volumes create politrade_data --size 1 --region iad -a politrade-ai
fly secrets set -a politrade-ai \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ADMIN_EMAIL="you@mail.com" ADMIN_PASSWORD="strong-pass" \
  PUBLIC_URL="https://politrade-ai.fly.dev" \
  DATA_FEED_URL="<public disclosure JSON url>" \
  TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..."     # + WhatsApp / email as needed
fly deploy -a politrade-ai
```
Auto-deploy on push to `main` via `.github/workflows/fly-deploy.yml` (set repo secret `FLY_API_TOKEN` + variable `FLY_APP`). Any always-on host with a persistent disk works (VPS + Docker, Railway, Render); shared/serverless hosting will not keep the SQLite file.

See `.env.example` for every setting.

## Tech
| | |
|---|---|
| Backend | Node 22, TypeScript, Express, `node:sqlite`, JWT, bcrypt, Zod, node-cron |
| AI | Anthropic Claude **or** Google Gemini (optional) |
| Alerts | Telegram Bot API · WhatsApp Cloud API · Email (HTTP provider) |
| Frontend | React 18, Vite, Tailwind CSS, React Router, Recharts, lucide-react |
| Deploy | Docker (node:22-slim), Fly.io |
