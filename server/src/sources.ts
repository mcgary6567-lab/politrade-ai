/**
 * Public sources of US congressional STOCK-Act disclosures, offered as one-click presets in the admin panel.
 * Every one republishes the official House Clerk / Senate eFD filings — the same public records every
 * trade tracker is built on. We never scrape third-party tracker websites.
 */
export const HISTORY_INDEX = "https://raw.githubusercontent.com/jorgeamolinas19/congress-trades/main/web/public/data/members.json";
export const DAILY_SNAPSHOT = "https://raw.githubusercontent.com/LuxAlgo/market-trackers-data/main/congress/trades/snapshot.json.gz";
export const POLS_SOURCE_DEFAULT = "https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-current.json";
export const PHOTO_URL = (bioguide: string) => `https://raw.githubusercontent.com/unitedstates/images/gh-pages/congress/225x275/${bioguide}.jpg`;

export const FEED_PRESETS = [
  {
    id: "full",
    name: "Full history + daily updates (recommended, free, no key)",
    urls: [HISTORY_INDEX, DAILY_SNAPSHOT],
    note: "Complete record of every disclosed stock trade since 2014 (House + Senate, ~43k trades, ~350 members) parsed from the official filings, plus a CC0 dataset rebuilt every day from the Senate eFD and House Clerk for the newest filings. First import takes 1–3 minutes.",
    key: false,
  },
  {
    id: "daily",
    name: "Daily updates only (LuxAlgo market-trackers, CC0)",
    urls: [DAILY_SNAPSHOT],
    note: "Only the newest filings (dataset started Aug 2026). Lightweight; use when history is already loaded.",
    key: false,
  },
  {
    id: "fmp",
    name: "Financial Modeling Prep API (needs API key)",
    urls: [
      "https://financialmodelingprep.com/stable/senate-latest?page=0&limit=250&apikey={KEY}",
      "https://financialmodelingprep.com/stable/house-latest?page=0&limit=250&apikey={KEY}",
    ],
    note: "Commercial API with a free tier: sign up at financialmodelingprep.com → API key → paste it below.",
    key: true,
  },
];
