import crypto from "node:crypto";
import { config } from "./config.js";
import { get, run, all } from "./db.js";
import { tradeInsight } from "./ai.js";
import { sendAlert, recordAlert } from "./notify.js";
import { integ } from "./settings.js";

const now = () => new Date().toISOString();

function upsertPolitician(p: { ext_id?: string; name: string; party?: string; chamber?: string; state?: string }): number {
  if (!p.name) throw new Error("politician name required");
  let row = p.ext_id ? get("SELECT id FROM politicians WHERE ext_id=?", p.ext_id) : null;
  if (!row) row = get("SELECT id FROM politicians WHERE name=?", p.name);
  if (row) { run("UPDATE politicians SET party=COALESCE(?,party), chamber=COALESCE(?,chamber), state=COALESCE(?,state) WHERE id=?", p.party ?? null, p.chamber ?? null, p.state ?? null, row.id); return row.id; }
  return Number(run("INSERT INTO politicians(ext_id,name,party,chamber,state,created_at) VALUES(?,?,?,?,?,?)",
    p.ext_id ?? null, p.name, p.party ?? null, p.chamber ?? null, p.state ?? null, now()).lastInsertRowid);
}

function upsertIssuer(i: { ticker?: string; name: string; sector?: string }): number {
  const row = i.ticker ? get("SELECT id FROM issuers WHERE ticker=?", i.ticker) : get("SELECT id FROM issuers WHERE name=?", i.name);
  if (row) return row.id;
  return Number(run("INSERT INTO issuers(ticker,name,sector,created_at) VALUES(?,?,?,?)",
    i.ticker ?? null, i.name, i.sector ?? null, now()).lastInsertRowid);
}

/** Insert a trade if new; returns the trade id when it was freshly created (so the caller can alert), else null. */
export async function recordTrade(t: {
  raw_id?: string; politician: { ext_id?: string; name: string; party?: string; chamber?: string; state?: string };
  issuer: { ticker?: string; name: string; sector?: string }; tx_type: string;
  tx_date?: string; published_date?: string; amount_min?: number; amount_max?: number; filed_after_days?: number; owner?: string; comment?: string;
}, opts: { alert: boolean }): Promise<number | null> {
  const rawId = t.raw_id ?? crypto.createHash("sha1").update([t.politician.name, t.issuer.ticker || t.issuer.name, t.tx_type, t.tx_date, t.amount_min].join("|")).digest("hex");
  if (get("SELECT 1 FROM trades WHERE raw_id=?", rawId)) return null;
  const polId = upsertPolitician(t.politician);
  const issId = upsertIssuer(t.issuer);
  const id = Number(run(
    `INSERT INTO trades(raw_id,politician_id,issuer_id,tx_type,tx_date,published_date,amount_min,amount_max,filed_after_days,owner,comment,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    rawId, polId, issId, normType(t.tx_type), t.tx_date ?? null, t.published_date ?? t.tx_date ?? now().slice(0, 10),
    t.amount_min ?? null, t.amount_max ?? null, t.filed_after_days ?? null, t.owner ?? null, t.comment ?? null, now(),
  ).lastInsertRowid);

  if (opts.alert) await fireAlert(id).catch(() => {});
  return id;
}

export function normType(s: string): string {
  const x = (s || "").toLowerCase();
  if (/purchase|buy|bought|acquire/.test(x)) return "buy";
  if (/sale|sell|sold|dispose/.test(x)) return "sell";
  if (/exchange/.test(x)) return "exchange";
  return "buy";
}

/** Build the alert text (with an AI note) and send it to every configured channel. */
export async function fireAlert(tradeId: number) {
  const t = get(`SELECT tr.*, p.name pol, p.party, p.chamber, i.ticker, i.name issuer
                 FROM trades tr JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id
                 WHERE tr.id=?`, tradeId);
  if (!t) return;
  if (!integ.alertsEnabled()) return;
  const brand = integ.brandName();
  const note = await tradeInsight({ politician: t.pol, party: t.party, chamber: t.chamber, ticker: t.ticker, issuer: t.issuer, tx_type: t.tx_type, amount_min: t.amount_min, amount_max: t.amount_max, tx_date: t.tx_date });
  run("UPDATE trades SET ai_note=? WHERE id=?", note, tradeId);
  const emoji = t.tx_type === "buy" ? "🟢 BUY" : t.tx_type === "sell" ? "🔴 SELL" : "🔄 EXCHANGE";
  const link = `${config.publicUrl}/trades`;
  const text = `<b>${brand} · ${emoji}</b>\n${note}\n\n${t.ticker ? `Ticker: ${t.ticker}\n` : ""}Filed: ${t.published_date ?? "-"}\n${link}`;
  const results = await sendAlert(text, `${brand}: ${t.pol} ${t.tx_type} ${t.ticker || t.issuer}`);
  recordAlert(tradeId, results);
  return results;
}

/** Pull the configured public disclosure feed and ingest new trades (firing alerts for each new one). */
export async function ingestFromFeed(): Promise<{ fetched: number; added: number; source: string }> {
  const url = integ.feedUrl();
  if (!url) throw new Error("No data feed URL set. Add one in Admin → Data feed.");
  const logId = Number(run("INSERT INTO ingest_log(started_at,source) VALUES(?,?)", now(), url).lastInsertRowid);
  try {
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": `${integ.brandName()}/1.0` } });
    if (!res.ok) throw new Error(`feed responded ${res.status}`);
    const data = await res.json() as any;
    const rows: any[] = Array.isArray(data) ? data : data.transactions ?? data.data ?? data.results ?? data.rows ?? [];
    let added = 0;
    for (const r of rows) {
      const t = normalizeFeedRow(r);
      if (!t) continue;
      const id = await recordTrade(t, { alert: true });
      if (id) added++;
    }
    run("UPDATE ingest_log SET finished_at=?, fetched=?, added=? WHERE id=?", now(), rows.length, added, logId);
    return { fetched: rows.length, added, source: url };
  } catch (e: any) {
    run("UPDATE ingest_log SET finished_at=?, error=? WHERE id=?", now(), String(e.message ?? e), logId);
    throw e;
  }
}

/** Import an array of records supplied by the admin (JSON upload) — same normalizer as the feed. */
export async function ingestRows(rows: any[], source = "manual"): Promise<{ fetched: number; added: number; source: string }> {
  const logId = Number(run("INSERT INTO ingest_log(started_at,source) VALUES(?,?)", now(), source).lastInsertRowid);
  let added = 0;
  for (const r of rows) {
    const t = normalizeFeedRow(r);
    if (!t) continue;
    if (await recordTrade(t, { alert: false })) added++;
  }
  run("UPDATE ingest_log SET finished_at=?, fetched=?, added=? WHERE id=?", now(), rows.length, added, logId);
  return { fetched: rows.length, added, source };
}

/** Map a public STOCK-Act-style disclosure record to our shape (tolerant of common field names). */
export function normalizeFeedRow(r: any): Parameters<typeof recordTrade>[0] | null {
  if (!r || typeof r !== "object") return null;
  const name = r.representative || r.senator || r.politician || r.politician_name || r.name;
  const ticker = (r.ticker || r.symbol || "").toString().replace(/[^A-Za-z.\-]/g, "").toUpperCase() || undefined;
  const issuer = r.asset_description || r.issuer || r.issuer_name || r.company || ticker || "Unknown";
  const type = r.type || r.transaction_type || r.tx_type || "";
  if (!name || !issuer || !type || ticker === "--") return null;
  const amt = parseAmount(r.amount || r.amount_range || "");
  const party = normParty(r.party);
  return {
    raw_id: r.id || r.raw_id || r.ptr_link ? String(r.id || r.raw_id || `${r.ptr_link}|${ticker}|${r.transaction_date}|${type}|${amt?.min}`) : undefined,
    politician: { ext_id: r.politician_id || r.bioguide_id, name, party, chamber: r.chamber || (r.senator ? "Senate" : r.representative ? "House" : undefined), state: r.state || r.district?.slice(0, 2) },
    issuer: { ticker, name: String(issuer).slice(0, 120), sector: r.sector || r.industry },
    tx_type: type, tx_date: normDate(r.transaction_date || r.tx_date), published_date: normDate(r.disclosure_date || r.published_date || r.filing_date),
    amount_min: amt?.min, amount_max: amt?.max, owner: r.owner, comment: r.comment,
  };
}

function normParty(p: any): string | undefined {
  const x = String(p ?? "").toLowerCase();
  if (!x) return undefined;
  if (x.startsWith("d")) return "Democrat";
  if (x.startsWith("r")) return "Republican";
  if (x.startsWith("i")) return "Independent";
  return String(p);
}

/** Accept 2024-01-31 or 01/31/2024 and return ISO date. */
function normDate(s: any): string | undefined {
  if (!s) return undefined;
  const str = String(s);
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return str.slice(0, 10);
}

function parseAmount(s: string): { min: number; max: number } | undefined {
  const nums = String(s).replace(/,/g, "").match(/\d+/g);
  if (!nums) return undefined;
  const [a, b] = nums.map(Number);
  return { min: a, max: b ?? a };
}

export function stats() {
  return {
    trades: get("SELECT COUNT(*) c FROM trades").c,
    politicians: get("SELECT COUNT(*) c FROM politicians").c,
    issuers: get("SELECT COUNT(*) c FROM issuers").c,
    last: get("SELECT MAX(published_date) d FROM trades")?.d,
  };
}
export { all };
