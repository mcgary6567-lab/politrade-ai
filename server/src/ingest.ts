import crypto from "node:crypto";
import { gunzipSync } from "node:zlib";
import { PHOTO_URL } from "./sources.js";
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
  // feeds spell names differently ("Hon. Nancy Pelosi" vs "Pelosi, Nancy"): match on first+last token too
  if (!row) { const k = nameKey(p.name); row = all("SELECT id, name FROM politicians").find((x: any) => nameKey(x.name) === k) ?? null; }
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
export async function ingestFromFeed(opts: { alerts?: boolean } = {}): Promise<{ fetched: number; added: number; source: string; errors: string[] }> {
  const urls = integ.feedUrls();
  if (!urls.length) throw new Error("No data feed URL set. Add one in Admin → Data feed.");
  const key = integ.feedApiKey();
  let fetched = 0, added = 0; const errors: string[] = [];
  for (const raw of urls) {
    const url = raw.replace(/\{KEY\}/g, encodeURIComponent(key));
    const safe = key ? url.split(encodeURIComponent(key)).join("***") : url;
    const logId = Number(run("INSERT INTO ingest_log(started_at,source) VALUES(?,?)", now(), safe).lastInsertRowid);
    try {
      if (/\{KEY\}/.test(raw) && !key) throw new Error("This source needs an API key — paste it in the Feed API key field");
      const rows = await loadSource(url);
      const hint: ChamberHint = /senate/i.test(url) ? "Senate" : /house/i.test(url) ? "House" : undefined;
      // oldest first so ids come out in filing order
      rows.sort((a, b) => String(a.__filed ?? a.filedAt ?? a.filing_date ?? a.disclosure_date ?? "").localeCompare(String(b.__filed ?? b.filedAt ?? b.filing_date ?? b.disclosure_date ?? "")));
      // only alert on filings from the last 30 days — a first run over years of history must not spam channels
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      let a = 0;
      for (const r of rows) {
        const t = normalizeFeedRow(r, hint);
        if (!t) continue;
        const recent = opts.alerts !== false && (t.published_date ?? "") >= cutoff;
        if (await recordTrade(t, { alert: recent })) a++;
      }
      fetched += rows.length; added += a;
      run("UPDATE ingest_log SET finished_at=?, fetched=?, added=? WHERE id=?", now(), rows.length, a, logId);
    } catch (e: any) {
      const msg = String(e.message ?? e);
      errors.push(`${safe.slice(0, 60)}… → ${msg}`);
      run("UPDATE ingest_log SET finished_at=?, error=? WHERE id=?", now(), msg, logId);
    }
  }
  if (errors.length === urls.length) throw new Error(errors.join(" | "));
  return { fetched, added, source: `${urls.length} source${urls.length > 1 ? "s" : ""}`, errors };
}

const UA = { accept: "application/json, */*", "user-agent": "PoliTradeAI/1.0 (+public STOCK Act data)" };

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url.slice(0, 80)} responded ${res.status}`);
  if (/\.gz($|\?)/.test(url) || res.headers.get("content-type")?.includes("gzip")) {
    const buf = Buffer.from(await res.arrayBuffer());
    const txt = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
    return JSON.parse(txt);
  }
  return res.json();
}

/**
 * Load every record a source URL offers. Three shapes are understood:
 *  - a JSON array (or {transactions|data|results|rows: [...]}) of trade records
 *  - a "member index" (array of {id, name, chamber, party, state, n_trades}) whose per-member files live at
 *    ./members/<id>.json next to it — each is fetched and its trades + other_trades are flattened
 *  - gzipped JSON (.gz)
 */
export async function loadSource(url: string): Promise<any[]> {
  const data = await fetchJson(url);
  const rows: any[] = Array.isArray(data) ? data : data.transactions ?? data.data ?? data.results ?? data.rows ?? [];
  const isIndex = rows.length && rows.every((r) => r && typeof r === "object" && r.id && r.name && ("n_trades" in r || "trades" in r)) && !rows[0].ticker && !rows[0].tx_date;
  if (!isIndex) return rows;
  const base = url.replace(/[^/]+$/, "") + "members/";
  const out: any[] = [];
  const queue = rows.filter((m) => (m.n_trades ?? 0) + (m.n_other ?? 0) > 0);
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const m = queue.shift()!;
      try {
        const d = await fetchJson(`${base}${m.id}.json`);
        for (const t of [...(d.trades ?? []), ...(d.other_trades ?? [])]) {
          out.push({ ...t, name: d.name ?? m.name, chamber: d.chamber ?? m.chamber, party: d.party ?? m.party, state: d.state ?? m.state, __filed: t.filing_date });
        }
      } catch (e: any) { console.warn(`[ingest] member ${m.id}: ${e.message}`); }
    }
  }));
  return out;
}

type ChamberHint = "House" | "Senate" | undefined;

/**
 * Sync the politicians directory from the public congress-legislators dataset (public domain):
 * fills party / state / chamber / bioguide id / photo for every politician we have trades for.
 */
export async function syncPoliticians(): Promise<{ legislators: number; matched: number; updated: number }> {
  const src = integ.polsSource();
  const res = await fetch(src, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`directory responded ${res.status}`);
  const list = await res.json() as any[];
  // members who have left Congress still have trades on record: add the historical roster (best effort)
  try {
    const hist = await fetch(src.replace("legislators-current", "legislators-historical"), { headers: { accept: "application/json" } });
    if (hist.ok) { const h = await hist.json() as any[]; for (const l of h) if (l.terms?.some((t: any) => t.start >= "2012")) list.push(l); }
  } catch { /* optional */ }
  const byKey = new Map<string, any>();
  for (const l of list) {
    const term = l.terms?.[l.terms.length - 1] ?? {};
    const info = {
      ext_id: l.id?.bioguide, name: `${term.type === "sen" ? "Sen." : "Rep."} ${l.name.first} ${l.name.last}`,
      party: normParty(term.party), chamber: term.type === "sen" ? "Senate" : "House", state: term.state,
      photo_url: l.id?.bioguide ? PHOTO_URL(l.id.bioguide) : null,
    };
    if (l.id?.bioguide) byKey.set(`bio:${l.id.bioguide}`, info);
    for (const k of nameKeys(l.name.first, l.name.last, l.name.nickname, l.name.official_full)) if (!byKey.has(k)) byKey.set(k, info);
  }
  let matched = 0, updated = 0;
  for (const p of all("SELECT id, name, ext_id FROM politicians")) {
    const hit = (p.ext_id ? byKey.get(`bio:${p.ext_id}`) : undefined) ?? byKey.get(nameKey(p.name))
      // former members are not in legislators-current, but their bioguide photo still exists
      ?? (p.ext_id ? { ext_id: p.ext_id, photo_url: PHOTO_URL(p.ext_id) } : undefined);
    if (!hit) continue;
    matched++;
    // two spellings of one person (one row already carrying this bioguide): fold this row into the other
    const dup = hit.ext_id ? get("SELECT id FROM politicians WHERE ext_id=? AND id<>?", hit.ext_id, p.id) : null;
    if (dup) {
      run("UPDATE trades SET politician_id=? WHERE politician_id=?", dup.id, p.id);
      run("DELETE FROM politicians WHERE id=?", p.id);
      updated++;
      continue;
    }
    const r = run("UPDATE politicians SET ext_id=COALESCE(?,ext_id), party=COALESCE(?,party), chamber=COALESCE(?,chamber), state=COALESCE(?,state), photo_url=COALESCE(?,photo_url) WHERE id=?",
      hit.ext_id ?? null, (hit as any).party ?? null, (hit as any).chamber ?? null, (hit as any).state ?? null, hit.photo_url, p.id);
    if (Number(r.changes)) updated++;
  }
  return { legislators: list.length, matched, updated };
}

/** "Rep. Nancy Pelosi", "Pelosi, Nancy", "Hon. Nancy Pelosi" → "nancy pelosi" (first + last token only). */
export function nameKey(n: string): string {
  let s = String(n ?? "").toLowerCase().replace(/\b(rep|sen|hon|mr|mrs|ms|dr)\.?\s+/g, "").replace(/\b(jr|sr|ii|iii|iv)\.?$/g, "").replace(/[^a-z ,'-]/g, "").trim();
  if (s.includes(",")) { const [last, first] = s.split(",").map((x) => x.trim()); s = `${first} ${last}`; }
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return s;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}
function nameKeys(first: string, last: string, nick?: string, full?: string): string[] {
  const out = [nameKey(`${first} ${last}`)];
  if (nick) out.push(nameKey(`${nick} ${last}`));
  if (full) out.push(nameKey(full));
  return out;
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
export function normalizeFeedRow(r: any, hint?: ChamberHint): Parameters<typeof recordTrade>[0] | null {
  if (!r || typeof r !== "object") return null;
  // name: stock-watcher (representative/senator), FMP (firstName/lastName), generic
  const member = r.member && typeof r.member === "object" ? r.member : null;   // LuxAlgo shape
  let name: string = member?.name || r.representative || r.senator || r.politician || r.politician_name || (typeof r.member === "string" ? r.member : "") || r.name
    || (r.firstName || r.lastName ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() : "")
    || (r.first_name || r.last_name ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() : "");
  if (!name) return null;
  const office = String(r.office ?? "");
  const chamber: ChamberHint = (r.chamber ? (/sen/i.test(r.chamber) ? "Senate" : "House") : undefined) || (r.senator ? "Senate" : r.representative ? "House" : undefined)
    || (/senat/i.test(office) ? "Senate" : /house|rep/i.test(office) ? "House" : undefined) || hint;
  name = cleanName(name, chamber);
  const ticker = (r.ticker || r.symbol || "").toString().replace(/[^A-Za-z.\-]/g, "").replace(/^[-.]+$/, "").toUpperCase() || undefined;
  const issuer = r.asset_description || r.assetDescription || r.asset_name || r.issuer || r.issuer_name || r.company || ticker || "Unknown";
  const type = r.side || r.type || r.transaction_type || r.tx_type || "";
  if (!issuer || !type) return null;
  if (/exempt|not applicable|^n\/a$/i.test(String(issuer))) return null;
  const amt = r.amountRange?.min != null ? { min: Number(r.amountRange.min), max: Number(r.amountRange.max ?? r.amountRange.min) }
    : r.amount_low != null ? { min: Number(r.amount_low), max: Number(r.amount_high ?? r.amount_low) }
    : parseAmount(r.amount || r.amount_raw || r.amount_range || r.amountRange?.text || "");
  const party = normParty(member?.party ?? r.party);
  const txDate = normDate(r.transaction_date || r.transactionDate || r.transactedAt || r.tx_date);
  const pubDate = normDate(r.disclosure_date || r.disclosureDate || r.filedAt || r.dateRecieved || r.dateReceived || r.published_date || r.filing_date || r.filingDate);
  const link = r.ptr_link || r.source_url || r.provenance?.sourceUrl || r.link || r.url;
  const district: string = String(r.district ?? r.state_dst ?? "");
  const state = member?.state || r.state || (/^[A-Z]{2}/.test(district) ? district.slice(0, 2) : undefined);
  const sector = r.sector || r.industry || r.asset_class || undefined;
  return {
    // content hash (not the source's own id) so the same filing arriving from two datasets is stored once
    raw_id: crypto.createHash("sha1").update([nameKey(name), ticker || String(issuer).replace(/\s+/g, " ").slice(0, 40).toLowerCase(), normType(type), txDate, pubDate ?? "", amt?.min ?? "", normOwner(r.owner) ?? ""].join("|")).digest("hex"),
    politician: { ext_id: member?.bioguideId || r.bioguide || r.politician_id || r.bioguide_id || r.bioguideId, name, party, chamber, state },
    issuer: { ticker, name: String(issuer).replace(/\s+/g, " ").slice(0, 120), sector },
    tx_type: type, tx_date: txDate, published_date: pubDate ?? txDate,
    amount_min: amt?.min, amount_max: amt?.max, owner: normOwner(r.owner), comment: r.comment || (link ? `Filing: ${link}` : undefined),
    filed_after_days: r.delay_days != null ? Number(r.delay_days) : txDate && pubDate ? Math.max(0, Math.round((Date.parse(pubDate) - Date.parse(txDate)) / 86400000)) : undefined,
  };
}

/** "Hon. Nancy Pelosi" / "Pelosi, Nancy" / "nancy pelosi" → "Rep. Nancy Pelosi" (title from chamber). */
function cleanName(n: string, chamber?: ChamberHint): string {
  let s = String(n).replace(/\s+/g, " ").trim();
  // generational suffixes travel to the end whatever the source order ("Cisneros, Jr., Gilbert Ray")
  const suffix = (s.match(/\b(Jr|Sr|II|III|IV)\.?(?=,|\s|$)/i)?.[1] ?? "");
  s = s.replace(/,?\s*\b(Jr|Sr|II|III|IV)\.?(?=,|\s|$)/gi, "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").trim();
  if (s.includes(",")) { const [last, first] = s.split(",").map((x) => x.trim()); s = `${first} ${last}`; }
  s = s.replace(/^(Hon\.?|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Rep\.?|Sen\.?|Senator|Representative)\s+/i, "").replace(/\s+/g, " ").trim();
  if (suffix) s += ` ${suffix.length <= 2 && /^(jr|sr)$/i.test(suffix) ? suffix[0].toUpperCase() + suffix.slice(1).toLowerCase() + "." : suffix.toUpperCase()}`;
  if (s === s.toLowerCase() || s === s.toUpperCase()) s = s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const title = chamber === "Senate" ? "Sen." : chamber === "House" ? "Rep." : "";
  return title ? `${title} ${s}` : s;
}

function normOwner(o: any): string | undefined {
  const x = String(o ?? "").toLowerCase().trim();
  if (!x || x === "--" || x === "undisclosed") return undefined;
  if (x.startsWith("sp")) return "spouse";
  if (x.startsWith("jt") || x.startsWith("joint")) return "joint";
  if (x.startsWith("dc") || x.includes("child") || x.includes("dependent")) return "child";
  if (x === "self") return "self";
  return x;
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
  const str = String(s).replace(/,/g, "");
  if (/over\s*\$?\s*50\s*0{6}|50000001/i.test(str)) return { min: 50000001, max: 50000001 };
  const nums = str.match(/\d+/g);
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
