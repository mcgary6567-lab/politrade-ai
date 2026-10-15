import { Router } from "express";
import { all, get } from "../db.js";
import { cached } from "../perf.js";
import { proPriceCents } from "../settings.js";

/** Serve politician photos from our own origin (disk-cached proxy) instead of 350 cross-origin GitHub requests. */
export const photoUrl = (p: any) => p?.ext_id ? `/api/photo/${p.ext_id}` : p?.photo_url ?? null;
const withPhoto = <T extends { ext_id?: string; photo_url?: string }>(rows: T[]) => rows.map((r) => ({ ...r, photo_url: photoUrl(r) }));

export const data = Router();

const SORTS: Record<string, string> = {
  published: "tr.published_date DESC, tr.id DESC", published_asc: "tr.published_date ASC, tr.id ASC",
  traded: "tr.tx_date DESC, tr.id DESC", traded_asc: "tr.tx_date ASC, tr.id ASC",
  amount: "COALESCE(tr.amount_max,tr.amount_min,0) DESC, tr.id DESC", amount_asc: "COALESCE(tr.amount_min,0) ASC, tr.id ASC",
  delay: "tr.filed_after_days DESC, tr.id DESC",
};

/** Shared WHERE builder for the trades feed (used by the list and the CSV export). */
function tradeFilters(qs: Record<string, string>) {
  const { q, type, party, chamber, state, ticker, politician, issuer, sector, owner, from, to, pub_from, pub_to, amount_min, amount_max, days } = qs;
  const where: string[] = []; const p: any[] = [];
  if (type) { where.push(`tr.tx_type IN (${type.split(",").map(() => "?").join(",")})`); p.push(...type.split(",")); }
  if (party) { where.push("p.party=?"); p.push(party); }
  if (chamber) { where.push("p.chamber=?"); p.push(chamber); }
  if (state) { where.push("p.state=?"); p.push(state.toUpperCase()); }
  if (ticker) { where.push("i.ticker=?"); p.push(ticker.toUpperCase()); }
  if (politician) { where.push("tr.politician_id=?"); p.push(Number(politician)); }
  if (issuer) { where.push("tr.issuer_id=?"); p.push(Number(issuer)); }
  if (sector) { where.push("COALESCE(i.sector,'Other')=?"); p.push(sector); }
  if (owner) { where.push("tr.owner=?"); p.push(owner); }
  if (from) { where.push("tr.tx_date>=?"); p.push(from); }
  if (to) { where.push("tr.tx_date<=?"); p.push(to); }
  if (pub_from) { where.push("tr.published_date>=?"); p.push(pub_from); }
  if (pub_to) { where.push("tr.published_date<=?"); p.push(pub_to); }
  if (days) { where.push("tr.published_date >= date('now', ?)"); p.push(`-${Math.max(1, Number(days))} days`); }
  if (amount_min) { where.push("COALESCE(tr.amount_max,tr.amount_min)>=?"); p.push(Number(amount_min)); }
  if (amount_max) { where.push("COALESCE(tr.amount_min,0)<=?"); p.push(Number(amount_max)); }
  if (q) { where.push("(p.name LIKE ? OR i.name LIKE ? OR i.ticker LIKE ?)"); const s = `%${q}%`; p.push(s, s, s); }
  return { w: where.length ? `WHERE ${where.join(" AND ")}` : "", p };
}

const TRADE_SELECT = `SELECT tr.id, tr.tx_type, tr.tx_date, tr.published_date, tr.amount_min, tr.amount_max, tr.filed_after_days, tr.owner, tr.ai_note,
            p.id politician_id, p.name politician, p.party, p.chamber, p.state, p.ext_id, p.photo_url,
            i.id issuer_id, i.ticker, i.name issuer, i.sector
     FROM trades tr JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id`;

/** GET /api/trades — filterable, sortable, paginated feed.
 *  Free plan: only the first FREE_VISIBLE trades are returned (the rest are locked); Pro (or admin) gets everything. */
const FREE_VISIBLE = 3;
/** Free plan: a politician's trade history shows only the first (most recent) trade; the rest are Pro-locked. */
const FREE_POL_TRADES = 1;

data.get("/trades", (req, res) => {
  const qs = req.query as Record<string, string>;
  const pro = Boolean(req.user?.pro);
  const order = SORTS[qs.sort ?? "published"] ?? SORTS.published;
  const { w, p } = tradeFilters(qs);
  const total = get(`SELECT COUNT(*) c FROM trades tr JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id ${w}`, ...p).c;
  // Pro paginates normally; Free sees only the first FREE_VISIBLE rows (offset ignored), the rest are locked.
  const limit = pro ? Math.min(Number(qs.limit ?? 50), 200) : FREE_VISIBLE;
  const offset = pro ? Math.max(Number(qs.offset ?? 0), 0) : 0;
  const rows = all(`${TRADE_SELECT} ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, ...p, limit, offset);
  const locked = pro ? 0 : Math.max(0, total - rows.length);
  res.json({ rows, total, limit, offset, plan: pro ? "pro" : "free", free_visible: pro ? null : FREE_VISIBLE, locked });
});

/** GET /api/trades.csv — same filters, CSV download (Pro). */
data.get("/trades.csv", (req, res) => {
  if (!req.user?.pro) return res.status(402).json({ error: "CSV export is a Pro feature" });
  const { w, p } = tradeFilters(req.query as Record<string, string>);
  const rows = all(`${TRADE_SELECT} ${w} ORDER BY ${SORTS.published} LIMIT 5000`, ...p);
  const cols = ["published_date", "tx_date", "politician", "party", "chamber", "state", "ticker", "issuer", "sector", "tx_type", "amount_min", "amount_max", "filed_after_days", "owner"];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  res.type("text/csv").attachment("trades.csv").send([cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n"));
});

/** GET /api/filters — distinct values to populate the filter controls. */
data.get("/filters", cached(300_000), (_req, res) => {
  res.json({
    parties: all("SELECT DISTINCT party v FROM politicians WHERE party IS NOT NULL ORDER BY v").map((r) => r.v),
    chambers: all("SELECT DISTINCT chamber v FROM politicians WHERE chamber IS NOT NULL ORDER BY v").map((r) => r.v),
    states: all("SELECT DISTINCT state v FROM politicians WHERE state IS NOT NULL ORDER BY v").map((r) => r.v),
    sectors: all("SELECT DISTINCT COALESCE(sector,'Other') v FROM issuers ORDER BY v").map((r) => r.v),
    owners: all("SELECT DISTINCT owner v FROM trades WHERE owner IS NOT NULL ORDER BY v").map((r) => r.v),
    tickers: all("SELECT DISTINCT ticker v FROM issuers WHERE ticker IS NOT NULL ORDER BY v").map((r) => r.v),
  });
});

data.get("/trades/:id", (req, res) => {
  const row = get(`${TRADE_SELECT} WHERE tr.id=?`, req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  // Free plan can only open the same FREE_VISIBLE most-recent trades it can see in the feed; the rest are Pro-locked.
  if (!req.user?.pro) {
    const open = get(`SELECT 1 FROM (SELECT id FROM trades ORDER BY published_date DESC, id DESC LIMIT ${FREE_VISIBLE}) WHERE id=?`, row.id);
    if (!open) return res.status(402).json({ error: "This trade is locked — upgrade to Pro to see the full feed", locked: true });
  }
  res.json({ trade: row });
});

/** GET /api/politicians — with trade counts + filters. */
data.get("/politicians", cached(120_000), (req, res) => {
  const { q, party, chamber, state, sort } = req.query as Record<string, string>;
  const where: string[] = []; const p: any[] = [];
  if (q) { where.push("p.name LIKE ?"); p.push(`%${q}%`); }
  if (party) { where.push("p.party=?"); p.push(party); }
  if (chamber) { where.push("p.chamber=?"); p.push(chamber); }
  if (state) { where.push("p.state=?"); p.push(state.toUpperCase()); }
  const order = sort === "name" ? "p.name" : sort === "recent" ? "last_traded DESC" : sort === "volume" ? "volume DESC" : "trades DESC, p.name";
  const rows = all(
    `SELECT p.*, COUNT(tr.id) trades,
            SUM(CASE WHEN tr.tx_type='buy' THEN 1 ELSE 0 END) buys,
            SUM(CASE WHEN tr.tx_type='sell' THEN 1 ELSE 0 END) sells,
            SUM(COALESCE(tr.amount_max,tr.amount_min,0)) volume,
            COUNT(DISTINCT tr.issuer_id) issuers,
            MAX(tr.published_date) last_traded
     FROM politicians p LEFT JOIN trades tr ON tr.politician_id=p.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY p.id ORDER BY ${order}`, ...p);
  res.json({ rows: withPhoto(rows) });
});

data.get("/politicians/:id", (req, res) => {
  const p0 = get("SELECT * FROM politicians WHERE id=?", req.params.id);
  const p = p0 ? { ...p0, photo_url: photoUrl(p0) } : null;
  if (!p) return res.status(404).json({ error: "Not found" });
  const pro = Boolean(req.user?.pro);
  // Free plan sees only the first (most recent) trade in this politician's history; the rest are Pro-locked.
  const allTrades = all(
    `SELECT tr.*, i.ticker, i.name issuer, i.sector FROM trades tr JOIN issuers i ON i.id=tr.issuer_id
     WHERE tr.politician_id=? ORDER BY tr.published_date DESC LIMIT 200`, req.params.id);
  const trades = pro ? allTrades : allTrades.slice(0, FREE_POL_TRADES);
  const tradesTotal = allTrades.length;
  const tradesLocked = pro ? 0 : Math.max(0, tradesTotal - trades.length);
  const summary = get(`SELECT COUNT(*) trades, SUM(CASE WHEN tx_type='buy' THEN 1 ELSE 0 END) buys,
      SUM(CASE WHEN tx_type='sell' THEN 1 ELSE 0 END) sells, SUM(COALESCE(amount_max,amount_min,0)) volume,
      AVG(filed_after_days) avg_delay, COUNT(DISTINCT issuer_id) issuers FROM trades WHERE politician_id=?`, req.params.id);
  const topIssuers = all(`SELECT i.ticker, i.name, i.sector, COUNT(*) trades FROM trades tr JOIN issuers i ON i.id=tr.issuer_id
      WHERE tr.politician_id=? GROUP BY i.id ORDER BY trades DESC LIMIT 6`, req.params.id);
  const bySector = all(`SELECT COALESCE(i.sector,'Other') sector, COUNT(*) trades FROM trades tr JOIN issuers i ON i.id=tr.issuer_id
      WHERE tr.politician_id=? GROUP BY sector ORDER BY trades DESC`, req.params.id);
  res.json({ politician: p, trades, summary, topIssuers, bySector, tradesTotal, tradesLocked, plan: pro ? "pro" : "free" });
});

/** GET /api/issuers — companies with trade counts + filters. */
data.get("/issuers", cached(120_000), (req, res) => {
  const { q, sector, sort } = req.query as Record<string, string>;
  const limit = Math.min(Number(req.query.limit ?? 60), 500);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const where: string[] = []; const p: any[] = [];
  if (q) { where.push("(i.name LIKE ? OR i.ticker LIKE ?)"); p.push(`%${q}%`, `%${q}%`); }
  if (sector) { where.push("COALESCE(i.sector,'Other')=?"); p.push(sector); }
  const order = sort === "name" ? "i.name" : sort === "recent" ? "last_traded DESC" : sort === "volume" ? "volume DESC" : sort === "politicians" ? "politicians DESC" : "trades DESC, i.name";
  const rows = all(
    `SELECT i.*, COUNT(tr.id) trades,
            SUM(CASE WHEN tr.tx_type='buy' THEN 1 ELSE 0 END) buys,
            SUM(CASE WHEN tr.tx_type='sell' THEN 1 ELSE 0 END) sells,
            SUM(COALESCE(tr.amount_max,tr.amount_min,0)) volume,
            COUNT(DISTINCT tr.politician_id) politicians,
            MAX(tr.published_date) last_traded
     FROM issuers i LEFT JOIN trades tr ON tr.issuer_id=i.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY i.id ORDER BY ${order} LIMIT ? OFFSET ?`, ...p, limit, offset);
  const total = get(`SELECT COUNT(*) c FROM issuers i ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`, ...p).c;
  res.json({ rows, total, limit, offset });
});

data.get("/issuers/:id", (req, res) => {
  const i = get("SELECT * FROM issuers WHERE id=?", req.params.id);
  if (!i) return res.status(404).json({ error: "Not found" });
  const trades = all(
    `SELECT tr.*, p.name politician, p.party, p.chamber, p.state FROM trades tr JOIN politicians p ON p.id=tr.politician_id
     WHERE tr.issuer_id=? ORDER BY tr.published_date DESC LIMIT 200`, req.params.id);
  const summary = get(`SELECT COUNT(*) trades, SUM(CASE WHEN tx_type='buy' THEN 1 ELSE 0 END) buys,
      SUM(CASE WHEN tx_type='sell' THEN 1 ELSE 0 END) sells, SUM(COALESCE(amount_max,amount_min,0)) volume,
      COUNT(DISTINCT politician_id) politicians FROM trades WHERE issuer_id=?`, req.params.id);
  const topPols = all(`SELECT p.id, p.name, p.party, p.chamber, COUNT(*) trades FROM trades tr JOIN politicians p ON p.id=tr.politician_id
      WHERE tr.issuer_id=? GROUP BY p.id ORDER BY trades DESC LIMIT 6`, req.params.id);
  res.json({ issuer: i, trades, summary, topPols });
});

/** GET /api/insights — aggregates for the dashboard + insights page. */
data.get("/insights", cached(120_000), (req, res) => {
  const days = Math.max(0, Number(req.query.days ?? 0));
  const w = days ? `WHERE tr.published_date >= date('now','-${days} days')` : "";
  const totals = get(`SELECT COUNT(*) trades,
      SUM(CASE WHEN tx_type='buy' THEN 1 ELSE 0 END) buys,
      SUM(CASE WHEN tx_type='sell' THEN 1 ELSE 0 END) sells,
      SUM(COALESCE(amount_max,amount_min,0)) volume,
      AVG(filed_after_days) avg_delay,
      COUNT(DISTINCT politician_id) politicians, COUNT(DISTINCT issuer_id) issuers FROM trades tr ${w}`);
  const topIssuers = all(`SELECT i.id, i.ticker, i.name, i.sector, COUNT(tr.id) trades,
      SUM(CASE WHEN tr.tx_type='buy' THEN 1 ELSE 0 END) buys, SUM(CASE WHEN tr.tx_type='sell' THEN 1 ELSE 0 END) sells
      FROM trades tr JOIN issuers i ON i.id=tr.issuer_id ${w} GROUP BY i.id ORDER BY trades DESC LIMIT 10`);
  const topPols = all(`SELECT p.id, p.name, p.party, p.chamber, COUNT(tr.id) trades, SUM(COALESCE(tr.amount_max,tr.amount_min,0)) volume
      FROM trades tr JOIN politicians p ON p.id=tr.politician_id ${w} GROUP BY p.id ORDER BY trades DESC LIMIT 10`);
  const byParty = all(`SELECT COALESCE(p.party,'Unknown') party, COUNT(tr.id) trades,
      SUM(CASE WHEN tr.tx_type='buy' THEN 1 ELSE 0 END) buys, SUM(CASE WHEN tr.tx_type='sell' THEN 1 ELSE 0 END) sells
      FROM trades tr JOIN politicians p ON p.id=tr.politician_id ${w} GROUP BY party ORDER BY trades DESC`);
  const byChamber = all(`SELECT COALESCE(p.chamber,'Unknown') chamber, COUNT(tr.id) trades
      FROM trades tr JOIN politicians p ON p.id=tr.politician_id ${w} GROUP BY chamber ORDER BY trades DESC`);
  const bySector = all(`SELECT COALESCE(i.sector,'Other') sector, COUNT(tr.id) trades,
      SUM(CASE WHEN tr.tx_type='buy' THEN 1 ELSE 0 END) buys, SUM(CASE WHEN tr.tx_type='sell' THEN 1 ELSE 0 END) sells
      FROM trades tr JOIN issuers i ON i.id=tr.issuer_id ${w} GROUP BY sector ORDER BY trades DESC LIMIT 10`);
  const byState = all(`SELECT p.state, COUNT(tr.id) trades FROM trades tr JOIN politicians p ON p.id=tr.politician_id
      ${w ? w + " AND" : "WHERE"} p.state IS NOT NULL GROUP BY p.state ORDER BY trades DESC LIMIT 12`);
  const volume = all(`SELECT substr(published_date,1,7) month, COUNT(*) trades,
      SUM(CASE WHEN tx_type='buy' THEN 1 ELSE 0 END) buys, SUM(CASE WHEN tx_type='sell' THEN 1 ELSE 0 END) sells,
      SUM(COALESCE(amount_max,amount_min,0)) volume FROM trades tr
      WHERE published_date IS NOT NULL ${days ? `AND published_date >= date('now','-${days} days')` : ""} GROUP BY month ORDER BY month DESC LIMIT 12`).reverse();
  const bands = all(`SELECT CASE WHEN COALESCE(amount_min,0) < 15001 THEN '$1K–15K' WHEN amount_min < 50001 THEN '$15K–50K'
      WHEN amount_min < 100001 THEN '$50K–100K' WHEN amount_min < 250001 THEN '$100K–250K' WHEN amount_min < 1000001 THEN '$250K–1M' ELSE '$1M+' END band,
      MIN(COALESCE(amount_min,0)) lo, COUNT(*) trades FROM trades tr ${w} GROUP BY band ORDER BY lo`);
  const lateFilers = all(`SELECT p.id, p.name, p.party, ROUND(AVG(tr.filed_after_days)) avg_delay, COUNT(*) trades
      FROM trades tr JOIN politicians p ON p.id=tr.politician_id ${w ? w + " AND" : "WHERE"} tr.filed_after_days IS NOT NULL
      GROUP BY p.id HAVING trades >= 2 ORDER BY avg_delay DESC LIMIT 6`);
  res.json({ totals, topIssuers, topPols, byParty, byChamber, bySector, byState, volume, bands, lateFilers });
});

/** GET /api/dashboard — the post-login overview: latest trades, notable filings, featured politicians / issuers, states. */
data.get("/dashboard", cached(60_000), (req, res) => {
  const stocksOnly = req.query.assets !== "all";
  const win = req.user?.pro ? "" : "AND tr.published_date >= date('now','-30 days')";
  const latest = all(`${TRADE_SELECT} WHERE 1=1 ${stocksOnly ? "AND i.ticker IS NOT NULL" : ""} ${win} ORDER BY tr.published_date DESC, tr.id DESC LIMIT 8`);
  // "insights": the most notable recent filings (largest ranges in the last 45 days), with the AI note when one exists
  const notable = all(`${TRADE_SELECT} WHERE tr.published_date >= date('now','-45 days') ${win}
      ORDER BY COALESCE(tr.amount_max,tr.amount_min,0) DESC, tr.published_date DESC LIMIT 6`);
  const months = all(`WITH RECURSIVE m(d) AS (SELECT date('now','start of month','-11 months') UNION ALL SELECT date(d,'+1 month') FROM m WHERE d < date('now','start of month')) SELECT substr(d,1,7) month FROM m`).map((r) => r.month);
  const featuredPols = all(`SELECT p.id, p.name, p.party, p.chamber, p.state, p.photo_url, p.ext_id, COUNT(*) trades, COUNT(DISTINCT tr.published_date) filings,
        COUNT(DISTINCT tr.issuer_id) issuers, SUM(COALESCE(tr.amount_max,tr.amount_min,0)) volume
      FROM trades tr JOIN politicians p ON p.id=tr.politician_id WHERE tr.published_date >= date('now','-12 months')
      GROUP BY p.id ORDER BY volume DESC LIMIT 3`).map((p) => ({
    ...p, series: fillMonths(months, all(`SELECT substr(published_date,1,7) month, SUM(tx_type='buy') buys, SUM(tx_type='sell') sells FROM trades
        WHERE politician_id=? AND published_date >= date('now','-12 months') GROUP BY month`, p.id)),
  }));
  const featuredIssuers = all(`SELECT i.id, i.ticker, i.name, i.sector, COUNT(*) trades, SUM(tr.tx_type='buy') buys, SUM(tr.tx_type='sell') sells,
        COUNT(DISTINCT tr.politician_id) politicians
      FROM trades tr JOIN issuers i ON i.id=tr.issuer_id WHERE i.ticker IS NOT NULL AND tr.published_date >= date('now','-3 years')
      GROUP BY i.id ORDER BY trades DESC LIMIT 5`).map((i) => ({
    ...i, series: fillMonths(months, all(`SELECT substr(published_date,1,7) month, COUNT(*) trades FROM trades WHERE issuer_id=? AND published_date >= date('now','-12 months') GROUP BY month`, i.id)),
  }));
  const states = all(`SELECT p.state, COUNT(*) trades, COUNT(DISTINCT p.id) politicians, SUM(COALESCE(tr.amount_max,tr.amount_min,0)) volume,
        SUM(p.party='Democrat') dem, SUM(p.party='Republican') rep
      FROM trades tr JOIN politicians p ON p.id=tr.politician_id WHERE p.state IS NOT NULL AND tr.published_date >= date('now','-3 years')
      GROUP BY p.state ORDER BY trades DESC`);
  res.json({ latest: withPhoto(latest as any), notable: withPhoto(notable as any), featuredPols: withPhoto(featuredPols as any), featuredIssuers, states, months, window: req.user?.pro ? null : 30 });
});

function fillMonths(months: string[], rows: any[]) {
  const by = new Map(rows.map((r) => [r.month, r]));
  return months.map((m) => ({ month: m, buys: by.get(m)?.buys ?? 0, sells: by.get(m)?.sells ?? 0, trades: by.get(m)?.trades ?? ((by.get(m)?.buys ?? 0) + (by.get(m)?.sells ?? 0)) }));
}

/** GET /api/signals — smart-money signals. Free members get a teaser (top one unlocked, the rest hidden). */
data.get("/signals", cached(600_000, (req) => `/signals?days=${req.query.days ?? 90}`), async (req, res) => {
  const { computeSignals, leaderboard, withTheses, marketStats } = await import("../signals.js");
  const days = Math.min(Math.max(Number(req.query.days ?? 90), 7), 365);
  const r = computeSignals(days, 12);
  await withTheses(r.buy, 5); await withTheses(r.sell, 2);
  const stats = marketStats();
  const lb = leaderboard(10).map((p) => ({ ...p, photo_url: photoUrl(p) }));
  if (req.user?.pro) return res.json({ ...r, leaderboard: lb, stats, locked: false });
  // teaser: full detail for the first buy signal only, the others only as count
  const lock = (s: any) => ({ ticker: "•••", issuer: "Locked — Pro members see every signal", issuer_id: 0, sector: s.sector, direction: s.direction, score: s.score, confidence: s.confidence, buyers: s.buyers, sellers: s.sellers, locked: true, reasons: [], topBuyers: [], volume: 0, bipartisan: s.bipartisan, lastFiled: s.lastFiled, days: s.days });
  res.json({ ...r, buy: r.buy.map((s, i) => (i === 0 ? s : lock(s))), sell: r.sell.map(lock), leaderboard: lb.slice(0, 3), stats, locked: true });
});

/** GET /api/invest — back-tested strategy stats + a model allocation across the current buy signals (Pro sees all rows). */
data.get("/invest", cached(600_000, () => "/invest"), async (req, res) => {
  const { strategyStats } = await import("../strategy.js");
  const { computeSignals } = await import("../signals.js");
  const strategy = strategyStats();
  const sigs = computeSignals(90, 8).buy;
  const total = sigs.reduce((a, s) => a + s.score, 0) || 1;
  const portfolio = sigs.map((s, i) => ({
    rank: i + 1, ticker: s.ticker, issuer: s.issuer, issuer_id: s.issuer_id, sector: s.sector, score: s.score, confidence: s.confidence,
    buyers: s.buyers, histHit: s.histHit, bipartisan: s.bipartisan, weight: Math.round((s.score / total) * 1000) / 10,
    topBuyer: s.topBuyers[0] ? { name: s.topBuyers[0].name, hit_rate: s.topBuyers[0].hit_rate } : null,
  }));
  const locked = !req.user?.pro;
  res.json({
    strategy, locked,
    portfolio: locked ? portfolio.map((p, i) => (i === 0 ? p : { ...p, ticker: "•••", issuer: "Locked — Pro", issuer_id: 0, topBuyer: null, locked: true })) : portfolio,
    proPriceCents: proPriceCents(),
  });
});
