/**
 * Corporate insider trades (SEC Form 4) straight from SEC EDGAR — free, public, no key.
 * Every business day EDGAR publishes a form index (daily-index/form.YYYYMMDD.idx); each Form 4 listed there is
 * fetched once and its open-market purchases (code P) and sales (code S) are stored. Awards, option exercises,
 * tax withholding and gifts are skipped: they are not a view on the stock.
 * SEC fair-access rules: identify with a contact email, stay under 10 requests a second.
 */
import { get, all, run, db } from "./db.js";
import { integ } from "./settings.js";

const EDGAR = "https://www.sec.gov/Archives/";
const now = () => new Date().toISOString();

export function migrateInsiders() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS insider_trades (
      id INTEGER PRIMARY KEY, raw_id TEXT UNIQUE, accession TEXT NOT NULL,
      ticker TEXT, issuer_name TEXT NOT NULL, issuer_cik TEXT,
      insider TEXT NOT NULL, insider_cik TEXT, role TEXT, officer_title TEXT,
      is_director INTEGER, is_officer INTEGER, is_ten_pct INTEGER,
      tx_type TEXT NOT NULL,            -- buy | sell (open-market P / S only)
      tx_date TEXT, filed_date TEXT, shares REAL, price REAL, value REAL, owned_after REAL,
      direct INTEGER, plan_10b5_1 INTEGER, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ins_ticker ON insider_trades(ticker, filed_date DESC);
    CREATE INDEX IF NOT EXISTS idx_ins_filed ON insider_trades(filed_date DESC);
    CREATE INDEX IF NOT EXISTS idx_ins_value ON insider_trades(value);
    CREATE TABLE IF NOT EXISTS insider_days (day TEXT PRIMARY KEY, filings INTEGER, added INTEGER, done_at TEXT);
  `);
}

/* ---------------- Form 4 XML ---------------- */

const tag = (xml: string, name: string): string | undefined => {
  const m = xml.match(new RegExp(`<${name}>\\s*(?:<value>)?\\s*([\\s\\S]*?)\\s*(?:</value>)?\\s*</${name}>`, "i"));
  return m ? decode(m[1].replace(/<footnoteId[^>]*\/>/g, "").replace(/<[^>]+>/g, "").trim()) : undefined;
};
const blocks = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "gi"))].map((m) => m[1]);
const flag = (v?: string) => (v ? (/^(1|true)$/i.test(v) ? 1 : 0) : 0);
const numOrNull = (v?: string) => { const n = Number(String(v ?? "").replace(/,/g, "")); return v && Number.isFinite(n) ? n : null; };
function decode(s: string) { return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'"); }

/** "HUANG JEN HSUN" → "Jen Hsun Huang" (EDGAR lists owners last name first, upper case). */
export function insiderName(n: string): string {
  const parts = n.replace(/\s+/g, " ").trim().split(" ");
  if (parts.length < 2 || n !== n.toUpperCase()) return n.trim();
  const tc = (w: string) => w.toLowerCase().replace(/(^|[-'])\w/g, (c) => c.toUpperCase());
  const suffix = /^(JR|SR|II|III|IV)\.?$/i.test(parts[parts.length - 1]) ? parts.pop()! : "";
  const [last, ...rest] = parts;
  return [...rest.map(tc), tc(last), suffix && (suffix.length <= 3 && /^(jr|sr)/i.test(suffix) ? tc(suffix.replace(/\.$/, "")) + "." : suffix)].filter(Boolean).join(" ");
}

export type InsiderTrade = {
  raw_id: string; accession: string; ticker?: string; issuer_name: string; issuer_cik?: string;
  insider: string; insider_cik?: string; role: string; officer_title?: string;
  is_director: number; is_officer: number; is_ten_pct: number;
  tx_type: "buy" | "sell"; tx_date?: string; shares: number | null; price: number | null; value: number | null;
  owned_after: number | null; direct: number; plan_10b5_1: number;
};

/** Parse one Form 4 ownershipDocument into its open-market buys and sells. */
export function parseForm4(xml: string, accession: string): InsiderTrade[] {
  const doc = xml.match(/<ownershipDocument>[\s\S]*<\/ownershipDocument>/i)?.[0];
  if (!doc) return [];
  if ((tag(doc, "documentType") ?? "4") !== "4") return [];
  const issuer = blocks(doc, "issuer")[0] ?? "";
  const owners = blocks(doc, "reportingOwner");
  const o = owners[0] ?? "";
  const rel = blocks(o, "reportingOwnerRelationship")[0] ?? "";
  const is_director = flag(tag(rel, "isDirector")), is_officer = flag(tag(rel, "isOfficer")), is_ten_pct = flag(tag(rel, "isTenPercentOwner"));
  const officer_title = tag(rel, "officerTitle") || undefined;
  const role = officer_title || (is_director ? "Director" : is_ten_pct ? "10% owner" : flag(tag(rel, "isOther")) ? (tag(rel, "otherText") || "Other") : "Insider");
  const rawName = tag(o, "rptOwnerName") ?? "Unknown";
  const insider = insiderName(rawName) + (owners.length > 1 ? ` +${owners.length - 1}` : "");
  const ticker = (tag(issuer, "issuerTradingSymbol") ?? "").toUpperCase().replace(/[^A-Z.\-]/g, "") || undefined;
  const plan = flag(tag(doc, "aff10b5One"));
  const out: InsiderTrade[] = [];
  blocks(doc, "nonDerivativeTransaction").forEach((t, i) => {
    const code = (tag(t, "transactionCode") ?? "").toUpperCase();
    if (code !== "P" && code !== "S") return;
    const shares = numOrNull(tag(t, "transactionShares")), price = numOrNull(tag(t, "transactionPricePerShare"));
    out.push({
      raw_id: `${accession}#${i}`, accession, ticker, issuer_name: tag(issuer, "issuerName") ?? ticker ?? "Unknown", issuer_cik: tag(issuer, "issuerCik"),
      insider, insider_cik: tag(o, "rptOwnerCik"), role, officer_title, is_director, is_officer, is_ten_pct,
      tx_type: code === "P" ? "buy" : "sell", tx_date: tag(t, "transactionDate")?.slice(0, 10),
      shares, price, value: shares != null && price != null ? Math.round(shares * price) : null,
      owned_after: numOrNull(tag(t, "sharesOwnedFollowingTransaction")),
      direct: (tag(t, "directOrIndirectOwnership") ?? "D").toUpperCase() === "D" ? 1 : 0, plan_10b5_1: plan,
    });
  });
  return out;
}

/** Form 4 entries of an EDGAR form.idx (one per filing — the index lists each filing under issuer and owner). */
export function parseFormIndex(idx: string): { file: string; date: string }[] {
  const seen = new Set<string>(); const out: { file: string; date: string }[] = [];
  for (const line of idx.split("\n")) {
    if (!/^4\s/.test(line)) continue;                         // "4" only: skips 4/A amendments and 40-F, 424B…
    const m = line.match(/(\d{8}|\d{4}-\d{2}-\d{2})\s+(edgar\/data\/\S+\.txt)\s*$/);
    if (!m || seen.has(m[2])) continue;
    seen.add(m[2]);
    const d = m[1].replace(/-/g, "");
    out.push({ file: m[2], date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` });
  }
  return out;
}

/* ---------------- fetching ---------------- */

let lastHit = 0;
async function sec(url: string): Promise<Response> {
  // global pacing: ~6 requests/second, below SEC's 10/s fair-access limit
  const wait = lastHit + 160 - Date.now();
  lastHit = Math.max(Date.now(), lastHit + 160);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const ua = `${integ.brandName()} ${integ.contactEmail()}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "user-agent": ua, "accept-encoding": "gzip, deflate" } });
    if ((res.status === 429 || res.status === 503) && attempt < 3) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
    return res;
  }
}

const insert = () => db.prepare(`INSERT OR IGNORE INTO insider_trades(raw_id,accession,ticker,issuer_name,issuer_cik,insider,insider_cik,role,officer_title,
  is_director,is_officer,is_ten_pct,tx_type,tx_date,filed_date,shares,price,value,owned_after,direct,plan_10b5_1,created_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

export function storeInsiderTrades(rows: InsiderTrade[], filed: string): number {
  const st = insert(); let n = 0;
  for (const t of rows) {
    n += Number(st.run(t.raw_id, t.accession, t.ticker ?? null, t.issuer_name, t.issuer_cik ?? null, t.insider, t.insider_cik ?? null, t.role, t.officer_title ?? null,
      t.is_director, t.is_officer, t.is_ten_pct, t.tx_type, t.tx_date ?? null, filed, t.shares, t.price, t.value, t.owned_after, t.direct, t.plan_10b5_1, now()).changes);
  }
  return n;
}

/** Ingest every Form 4 filed on one day. Returns null when EDGAR has no index for that day (yet). */
export async function ingestInsiderDay(day: string): Promise<{ filings: number; added: number } | null> {
  const d = new Date(day + "T12:00:00Z");
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  const res = await sec(`${EDGAR}edgar/daily-index/${d.getUTCFullYear()}/QTR${q}/form.${day.replace(/-/g, "")}.idx`);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`EDGAR index ${day} responded ${res.status}`);
  const filings = parseFormIndex(await res.text());
  let added = 0;
  const queue = [...filings];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const f = queue.shift()!;
      try {
        const r = await sec(EDGAR + f.file);
        if (!r.ok) continue;
        const accession = f.file.split("/").pop()!.replace(/\.txt$/, "");
        added += storeInsiderTrades(parseForm4(await r.text(), accession), f.date);
      } catch (e: any) { console.warn(`[insiders] ${f.file}: ${e.message}`); }
    }
  }));
  return { filings: filings.length, added };
}

let running = false;
/**
 * Catch up on the last `days` business days that are not done yet (newest first, so fresh filings land quickly).
 * A day is done once its index was read; a missing index older than 3 days is a market holiday.
 */
export async function ingestInsiders(days = Number(process.env.INSIDER_DAYS ?? 5)): Promise<{ days: string[]; filings: number; added: number }> {
  if (running) return { days: [], filings: 0, added: 0 };
  running = true;
  const out = { days: [] as string[], filings: 0, added: 0 };
  try {
    const todo: string[] = [];
    for (let i = 0, d = new Date(); todo.length < days && i < days * 2 + 4; i++, d = new Date(d.getTime() - 86400000)) {
      const day = d.toISOString().slice(0, 10), wd = d.getUTCDay();
      if (wd === 0 || wd === 6) continue;
      todo.push(day);
    }
    for (const day of todo) {
      if (get("SELECT 1 FROM insider_days WHERE day=?", day)) continue;
      const r = await ingestInsiderDay(day);
      const old = Date.now() - Date.parse(day) > 3 * 86400000;
      if (!r) { if (old) run("INSERT OR REPLACE INTO insider_days(day,filings,added,done_at) VALUES(?,0,0,?)", day, now()); continue; }
      run("INSERT OR REPLACE INTO insider_days(day,filings,added,done_at) VALUES(?,?,?,?)", day, r.filings, r.added, now());
      out.days.push(day); out.filings += r.filings; out.added += r.added;
      console.log(`[insiders] ${day}: ${r.filings} Form 4 filings, ${r.added} open-market trades added`);
    }
  } finally { running = false; }
  return out;
}

export function insiderStats() {
  return {
    trades: get("SELECT COUNT(*) c FROM insider_trades").c as number,
    last: (get("SELECT MAX(filed_date) d FROM insider_trades")?.d ?? null) as string | null,
    days: all("SELECT day, filings, added FROM insider_days ORDER BY day DESC LIMIT 10"),
  };
}
