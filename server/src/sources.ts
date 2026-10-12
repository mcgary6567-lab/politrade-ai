/**
 * Known public sources of US congressional STOCK-Act disclosures, offered as one-click presets in the
 * admin panel. All of them republish the official House Clerk / Senate eFD filings — the same public
 * records every trade tracker is built on. We never scrape third-party tracker websites.
 */
export const FEED_PRESETS = [
  {
    id: "stockwatcher",
    name: "House + Senate Stock Watcher (open datasets, free, no key)",
    urls: [
      "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json",
      "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json",
    ],
    note: "Community-maintained open datasets parsed from the official filings. Large files (all history) — first run can take a minute. May lag a few days behind.",
    key: false,
  },
  {
    id: "fmp",
    name: "Financial Modeling Prep API (needs free API key, always current)",
    urls: [
      "https://financialmodelingprep.com/stable/senate-latest?page=0&limit=250&apikey={KEY}",
      "https://financialmodelingprep.com/stable/house-latest?page=0&limit=250&apikey={KEY}",
    ],
    note: "Sign up at financialmodelingprep.com → API key → paste it below. Returns the latest filings; the scheduler keeps the history growing.",
    key: true,
  },
];

export const POLS_SOURCE_DEFAULT = "https://unitedstates.github.io/congress-legislators/legislators-current.json";
