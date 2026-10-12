import { get } from "./db.js";
import { recordTrade } from "./ingest.js";

/**
 * Demo data so the app works out of the box. The politicians below are FICTIONAL sample profiles —
 * we never attach fabricated trades to real people. In production, point DATA_FEED_URL at a public
 * congressional-disclosure feed (STOCK Act data) and real records are ingested instead.
 */
const POLS = [
  { name: "Rep. Jordan Avery", party: "Democrat", chamber: "House", state: "CA" },
  { name: "Sen. Morgan Blake", party: "Republican", chamber: "Senate", state: "TX" },
  { name: "Rep. Taylor Quinn", party: "Republican", chamber: "House", state: "FL" },
  { name: "Sen. Casey Rivera", party: "Democrat", chamber: "Senate", state: "NY" },
  { name: "Rep. Riley Monroe", party: "Independent", chamber: "House", state: "VT" },
  { name: "Sen. Drew Carter", party: "Democrat", chamber: "Senate", state: "WA" },
  { name: "Rep. Alex Sutton", party: "Republican", chamber: "House", state: "OH" },
  { name: "Sen. Jamie Ellis", party: "Republican", chamber: "Senate", state: "AZ" },
];
const ISS = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology" },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Semiconductors" },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Automotive" },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer" },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
  { ticker: "XOM", name: "Exxon Mobil Corp.", sector: "Energy" },
  { ticker: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
  { ticker: "LMT", name: "Lockheed Martin Corp.", sector: "Defense" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
  { ticker: "META", name: "Meta Platforms Inc.", sector: "Technology" },
  { ticker: "BAC", name: "Bank of America Corp.", sector: "Financials" },
];
const BANDS = [[1001, 15000], [15001, 50000], [50001, 100000], [100001, 250000], [250001, 500000]];
const TYPES = ["buy", "buy", "sell", "buy", "sell", "exchange"];

export async function seedDemo() {
  if (get("SELECT 1 FROM trades LIMIT 1")) return;
  const today = new Date();
  let n = 0;
  for (let i = 0; i < 44; i++) {
    const pol = POLS[i % POLS.length];
    const iss = ISS[(i * 5 + 3) % ISS.length];
    const band = BANDS[(i * 7) % BANDS.length];
    const td = new Date(today.getTime() - ((i * 3 + 2) * 86400000));
    const pd = new Date(td.getTime() + ((i % 20) + 2) * 86400000);
    await recordTrade({
      raw_id: `demo-${i}`, politician: pol, issuer: iss, tx_type: TYPES[i % TYPES.length],
      tx_date: td.toISOString().slice(0, 10), published_date: pd.toISOString().slice(0, 10),
      amount_min: band[0], amount_max: band[1], filed_after_days: (pd.getTime() - td.getTime()) / 86400000, owner: "self",
    }, { alert: false });
    n++;
  }
  console.log(`[seed] demo data ready: ${n} trades`);
}
