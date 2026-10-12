import crypto from "node:crypto";
import { config } from "./config.js";
import { get, run, all } from "./db.js";
import { tradeInsight } from "./ai.js";
import { sendAlert, recordAlert } from "./notify.js";

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
  const note = await tradeInsight({ politician: t.pol, party: t.party, chamber: t.chamber, ticker: t.ticker, issuer: t.issuer, tx_type: t.tx_type, amount_min: t.amount_min, amount_max: t.amount_max, tx_date: t.tx_date });
  run("UPDATE trades SET ai_note=? WHERE id=?", note, tradeId);
  const emoji = t.tx_type === "buy" ? "🟢 BUY" : t.tx_type === "sell" ? "🔴 SELL" : "🔄 EXCHANGE";
  const link = `${config.publicUrl}/trades`;
  const text = `<b>${config.brandName} · ${emoji}</b>\n${note}\n\n${t.ticker ? `Ticker: ${t.ticker}\n` : ""}Filed: ${t.published_date ?? "-"}\n${link}`;
  const results = await sendAlert(text, `${config.brandName}: ${t.pol} ${t.tx_type} ${t.ticker || t.issuer}`);
  recordAlert(tradeId, results);
  return results;
}

/** Pull the configured public disclosure feed and ingest new trades (firing alerts for each new one). */
export async function ingestFromFeed(): Promise<{ fetched: number; added: number }> {
  if (!config.dataFeedUrl) return { fetched: 0, added: 0 };
  const res = await fetch(config.dataFeedUrl, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const data = await res.json() as any[];
  const rows = Array.isArray(data) ? data : (data as any).transactions ?? [];
  let added = 0;
  for (const r of rows) {
    const t = normalizeFeedRow(r);
    if (!t) continue;
    const id = await recordTrade(t, { alert: true });
    if (id) added++;
  }
  return { fetched: rows.length, added };
}

/** Map a public STOCK-Act-style disclosure record to our shape (tolerant of common field names). */
function normalizeFeedRow(r: any): Parameters<typeof recordTrade>[0] | null {
  const name = r.representative || r.senator || r.politician || r.name;
  const ticker = (r.ticker || r.symbol || "").toString().replace(/[^A-Za-z.\-]/g, "").toUpperCase() || undefined;
  const issuer = r.asset_description || r.issuer || r.company || ticker || "Unknown";
  const type = r.type || r.transaction_type || r.tx_type || "";
  if (!name || !issuer || !type) return null;
  const amt = parseAmount(r.amount || r.amount_range || "");
  return {
    politician: { name, party: r.party, chamber: r.chamber || (r.senator ? "Senate" : r.representative ? "House" : undefined), state: r.state },
    issuer: { ticker, name: String(issuer) },
    tx_type: type, tx_date: r.transaction_date || r.tx_date, published_date: r.disclosure_date || r.published_date || r.filing_date,
    amount_min: amt?.min, amount_max: amt?.max, owner: r.owner,
  };
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
