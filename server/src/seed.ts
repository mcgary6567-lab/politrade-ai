import { get } from "./db.js";
import { recordTrade } from "./ingest.js";

/**
 * Demo data so the app works out of the box. The politicians below are FICTIONAL sample profiles —
 * we never attach fabricated trades to real people. In production, set the data feed URL (Admin → Data feed)
 * to a public congressional-disclosure feed (STOCK Act data) and real records are ingested instead;
 * then use Admin → "Clear demo data".
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
  { name: "Rep. Harper Lane", party: "Democrat", chamber: "House", state: "IL" },
  { name: "Sen. Rowan Fitzgerald", party: "Republican", chamber: "Senate", state: "GA" },
  { name: "Rep. Dakota Reyes", party: "Democrat", chamber: "House", state: "NM" },
  { name: "Sen. Emerson Hale", party: "Democrat", chamber: "Senate", state: "MA" },
  { name: "Rep. Skyler Nguyen", party: "Republican", chamber: "House", state: "NC" },
  { name: "Sen. Peyton Walsh", party: "Republican", chamber: "Senate", state: "TN" },
  { name: "Rep. Avery Castellano", party: "Democrat", chamber: "House", state: "NJ" },
  { name: "Sen. Finley Brooks", party: "Independent", chamber: "Senate", state: "ME" },
  { name: "Rep. Quinn Delgado", party: "Republican", chamber: "House", state: "PA" },
  { name: "Sen. Sawyer Kim", party: "Democrat", chamber: "Senate", state: "MI" },
  { name: "Rep. Blair Okafor", party: "Democrat", chamber: "House", state: "MD" },
  { name: "Sen. Reese Thornton", party: "Republican", chamber: "Senate", state: "SC" },
  { name: "Rep. Cameron Ito", party: "Republican", chamber: "House", state: "UT" },
  { name: "Sen. Logan Pierce", party: "Democrat", chamber: "Senate", state: "CO" },
  { name: "Rep. Micah Rosenberg", party: "Democrat", chamber: "House", state: "OR" },
  { name: "Sen. Kendall Marsh", party: "Republican", chamber: "Senate", state: "KY" },
];
const ISS = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology" },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Semiconductors" },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors" },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Automotive" },
  { ticker: "F", name: "Ford Motor Co.", sector: "Automotive" },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer" },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Consumer" },
  { ticker: "COST", name: "Costco Wholesale", sector: "Consumer" },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
  { ticker: "BAC", name: "Bank of America Corp.", sector: "Financials" },
  { ticker: "GS", name: "Goldman Sachs Group", sector: "Financials" },
  { ticker: "V", name: "Visa Inc.", sector: "Financials" },
  { ticker: "XOM", name: "Exxon Mobil Corp.", sector: "Energy" },
  { ticker: "CVX", name: "Chevron Corp.", sector: "Energy" },
  { ticker: "NEE", name: "NextEra Energy", sector: "Energy" },
  { ticker: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { ticker: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
  { ticker: "LLY", name: "Eli Lilly and Co.", sector: "Healthcare" },
  { ticker: "LMT", name: "Lockheed Martin Corp.", sector: "Defense" },
  { ticker: "RTX", name: "RTX Corp.", sector: "Defense" },
  { ticker: "NOC", name: "Northrop Grumman", sector: "Defense" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
  { ticker: "META", name: "Meta Platforms Inc.", sector: "Technology" },
  { ticker: "CRM", name: "Salesforce Inc.", sector: "Technology" },
  { ticker: "PLTR", name: "Palantir Technologies", sector: "Technology" },
  { ticker: "DIS", name: "Walt Disney Co.", sector: "Media" },
  { ticker: "NFLX", name: "Netflix Inc.", sector: "Media" },
  { ticker: "BA", name: "Boeing Co.", sector: "Industrials" },
  { ticker: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
  { ticker: "UNP", name: "Union Pacific Corp.", sector: "Industrials" },
  { ticker: "KO", name: "Coca-Cola Co.", sector: "Consumer" },
  { ticker: "PG", name: "Procter & Gamble", sector: "Consumer" },
  { ticker: "T", name: "AT&T Inc.", sector: "Telecom" },
  { ticker: "VZ", name: "Verizon Communications", sector: "Telecom" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF", sector: "ETF" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", sector: "ETF" },
  { ticker: "BTC", name: "Bitcoin (via ETF)", sector: "Crypto" },
  { ticker: "COIN", name: "Coinbase Global", sector: "Crypto" },
];
const BANDS = [[1001, 15000], [1001, 15000], [1001, 15000], [15001, 50000], [15001, 50000], [50001, 100000], [100001, 250000], [250001, 500000], [500001, 1000000], [1000001, 5000000]];
const TYPES = ["buy", "buy", "sell", "buy", "sell", "buy", "sell", "exchange"];
const OWNERS = ["self", "self", "spouse", "self", "joint", "child"];

/** Small deterministic PRNG so every install gets the same believable demo set. */
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export async function seedDemo() {
  if (get("SELECT 1 FROM trades LIMIT 1")) return;
  const today = new Date();
  const rand = rng(20241);
  let n = 0;
  const COUNT = 420;
  for (let i = 0; i < COUNT; i++) {
    // a few "active traders" to make the leaderboards interesting
    const polIdx = rand() < 0.35 ? Math.floor(rand() * 6) : Math.floor(rand() * POLS.length);
    const pol = POLS[polIdx];
    // each politician leans toward a couple of favourite sectors
    const favIss = (polIdx * 7 + Math.floor(rand() * 5)) % ISS.length;
    const iss = rand() < 0.5 ? ISS[favIss] : ISS[Math.floor(rand() * ISS.length)];
    const band = BANDS[Math.floor(rand() * BANDS.length)];
    const daysAgo = Math.floor(rand() * 365);
    const td = new Date(today.getTime() - daysAgo * 86400000);
    const delay = Math.floor(rand() < 0.8 ? 3 + rand() * 42 : 46 + rand() * 120);
    const pd = new Date(Math.min(td.getTime() + delay * 86400000, today.getTime()));
    await recordTrade({
      raw_id: `demo-${i}`, politician: pol, issuer: iss, tx_type: TYPES[Math.floor(rand() * TYPES.length)],
      tx_date: td.toISOString().slice(0, 10), published_date: pd.toISOString().slice(0, 10),
      amount_min: band[0], amount_max: band[1], filed_after_days: Math.round((pd.getTime() - td.getTime()) / 86400000),
      owner: OWNERS[Math.floor(rand() * OWNERS.length)],
    }, { alert: false });
    n++;
  }
  console.log(`[seed] demo data ready: ${n} trades (fictional sample profiles)`);
}
