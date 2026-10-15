/**
 * Ticker → sector map for the companies most traded by Congress. The LuxAlgo feed rarely carries a sector,
 * so we fill it from this curated list (keyless, no external calls). The feed's own sector/asset_class wins
 * when present; everything else falls back here, and unknown long-tail tickers stay blank.
 */
import { all, run } from "./db.js";

const BY_SECTOR: Record<string, string[]> = {
  Technology: ["AAPL", "MSFT", "ORCL", "CRM", "ADBE", "CSCO", "IBM", "INTU", "NOW", "ACN", "AMD", "DELL", "HPQ", "HPE", "PANW", "SNOW", "PLTR", "CRWD", "FTNT", "ANET", "SMCI", "WDAY", "TEAM", "DDOG", "NET", "SHOP", "UBER", "SQ", "ADP", "FISV", "FI", "GLW", "APH", "MSI", "KEYS"],
  Semiconductors: ["NVDA", "AVGO", "TXN", "QCOM", "INTC", "MU", "AMAT", "LRCX", "KLAC", "ASML", "TSM", "ADI", "MRVL", "ON", "NXPI", "MCHP", "ARM", "STM"],
  "Communication Services": ["META", "GOOGL", "GOOG", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR", "WBD", "EA", "TTWO", "SNAP", "PINS", "SPOT", "RBLX", "MTCH", "OMC", "IPG", "FOXA", "PARA"],
  "Consumer Discretionary": ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "BKNG", "TJX", "MAR", "GM", "F", "CMG", "ORLY", "AZO", "LULU", "RCL", "CCL", "NCLH", "ABNB", "DHI", "LEN", "YUM", "ROST", "GPC", "HLT", "EBAY", "DG", "DLTR", "BBY", "ULTA", "RIVN", "LCID", "NIO"],
  "Consumer Staples": ["PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "MDLZ", "CL", "KMB", "GIS", "KHC", "STZ", "TGT", "KR", "SYY", "ADM", "HSY", "K", "CAG", "CLX", "EL", "KDP", "MNST"],
  Financials: ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW", "AXP", "SPGI", "BRK.B", "BRK.A", "V", "MA", "PYPL", "COF", "USB", "PNC", "TFC", "CB", "MMC", "ICE", "CME", "AON", "PGR", "MET", "AIG", "TRV", "BX", "KKR", "APO", "ALL", "AFL", "PRU", "DFS", "SYF", "FITB", "HIG", "MSCI", "MCO", "NDAQ"],
  "Health Care": ["UNH", "JNJ", "LLY", "ABBV", "MRK", "PFE", "TMO", "ABT", "DHR", "BMY", "AMGN", "MDT", "CVS", "CI", "ELV", "GILD", "ISRG", "VRTX", "REGN", "ZTS", "SYK", "BSX", "HCA", "MRNA", "BIIB", "HUM", "IQV", "IDXX", "DXCM", "EW", "A", "BAX", "BDX", "CNC", "MCK", "RMD"],
  Industrials: ["BA", "CAT", "HON", "GE", "UPS", "RTX", "LMT", "DE", "UNP", "FDX", "NOC", "GD", "EMR", "ETN", "CSX", "NSC", "MMM", "ITW", "WM", "GEV", "PH", "TT", "CARR", "OTIS", "CMI", "ROK", "PCAR", "GWW", "FAST", "LHX", "AXON", "RSG", "URI", "PWR"],
  Energy: ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "WMB", "KMI", "HAL", "DVN", "HES", "OKE", "LNG", "BKR", "FANG", "CTRA", "TRGP"],
  Materials: ["LIN", "APD", "SHW", "FCX", "NEM", "DOW", "DD", "ECL", "NUE", "CTVA", "VMC", "MLM", "PPG", "ALB", "CF", "MOS", "STLD"],
  Utilities: ["NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL", "PEG", "ED", "PCG", "WEC", "AEE", "DTE", "EIX", "CEG", "VST", "PPL", "FE"],
  "Real Estate": ["PLD", "AMT", "EQIX", "CCI", "PSA", "O", "SPG", "WELL", "DLR", "VICI", "AVB", "EQR", "SBAC", "EXR", "CBRE"],
  "ETF / Index": ["SPY", "VOO", "QQQ", "IVV", "VTI", "DIA", "IWM", "VEA", "VWO", "SCHD", "VUG", "VTV", "VIG", "VXUS", "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC", "GLD", "SLV", "TLT", "IEF", "AGG", "BND", "LQD", "HYG", "ARKK", "VYM", "IEMG", "IJR", "IWD", "IWF"],
};

const TICKER_SECTOR: Record<string, string> = {};
for (const [sector, tickers] of Object.entries(BY_SECTOR)) for (const t of tickers) TICKER_SECTOR[t] = sector;

/** Best sector for an issuer: the ticker map first, then bond/treasury detection from the name. */
export function sectorFor(ticker?: string | null, name?: string | null): string | undefined {
  if (ticker && TICKER_SECTOR[ticker.toUpperCase()]) return TICKER_SECTOR[ticker.toUpperCase()];
  const n = (name ?? "").toLowerCase();
  if (/\b(treasury|t-bill|t-note|t-bond|municipal|muni|govt bond|government bond|u\.s\. bond|corporate bond)\b/.test(n)) return "Bonds & Treasuries";
  return undefined;
}

/** One-time-ish backfill: set the sector on issuers that don't have one yet (cheap, idempotent). */
export function backfillSectors(): number {
  let n = 0;
  for (const r of all("SELECT id, ticker, name FROM issuers WHERE sector IS NULL OR sector=''") as { id: number; ticker?: string; name?: string }[]) {
    const s = sectorFor(r.ticker, r.name);
    if (s) { run("UPDATE issuers SET sector=? WHERE id=?", s, r.id); n++; }
  }
  return n;
}
