import { Router } from "express";
import { all, get } from "../db.js";

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
            p.id politician_id, p.name politician, p.party, p.chamber, p.state,
            i.id issuer_id, i.ticker, i.name issuer, i.sector
     FROM trades tr JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id`;

/** GET /api/trades — filterable, sortable, paginated feed. */
data.get("/trades", (req, res) => {
  const qs = req.query as Record<string, string>;
  const limit = Math.min(Number(qs.limit ?? 50), 200);
  const offset = Math.max(Number(qs.offset ?? 0), 0);
  const order = SORTS[qs.sort ?? "published"] ?? SORTS.published;
  const { w, p } = tradeFilters(qs);
  const rows = all(`${TRADE_SELECT} ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, ...p, limit, offset);
  const total = get(`SELECT COUNT(*) c FROM trades tr JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id ${w}`, ...p).c;
  res.json({ rows, total, limit, offset });
});

/** GET /api/trades.csv — same filters, CSV download. */
data.get("/trades.csv", (req, res) => {
  const { w, p } = tradeFilters(req.query as Record<string, string>);
  const rows = all(`${TRADE_SELECT} ${w} ORDER BY ${SORTS.published} LIMIT 5000`, ...p);
  const cols = ["published_date", "tx_date", "politician", "party", "chamber", "state", "ticker", "issuer", "sector", "tx_type", "amount_min", "amount_max", "filed_after_days", "owner"];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  res.type("text/csv").attachment("trades.csv").send([cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n"));
});

/** GET /api/filters — distinct values to populate the filter controls. */
data.get("/filters", (_req, res) => {
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
  res.json({ trade: row });
});

/** GET /api/politicians — with trade counts + filters. */
data.get("/politicians", (req, res) => {
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
  res.json({ rows });
});

data.get("/politicians/:id", (req, res) => {
  const p = get("SELECT * FROM politicians WHERE id=?", req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  const trades = all(
    `SELECT tr.*, i.ticker, i.name issuer, i.sector FROM trades tr JOIN issuers i ON i.id=tr.issuer_id
     WHERE tr.politician_id=? ORDER BY tr.published_date DESC LIMIT 200`, req.params.id);
  const summary = get(`SELECT COUNT(*) trades, SUM(CASE WHEN tx_type='buy' THEN 1 ELSE 0 END) buys,
      SUM(CASE WHEN tx_type='sell' THEN 1 ELSE 0 END) sells, SUM(COALESCE(amount_max,amount_min,0)) volume,
      AVG(filed_after_days) avg_delay, COUNT(DISTINCT issuer_id) issuers FROM trades WHERE politician_id=?`, req.params.id);
  const topIssuers = all(`SELECT i.ticker, i.name, i.sector, COUNT(*) trades FROM trades tr JOIN issuers i ON i.id=tr.issuer_id
      WHERE tr.politician_id=? GROUP BY i.id ORDER BY trades DESC LIMIT 6`, req.params.id);
  const bySector = all(`SELECT COALESCE(i.sector,'Other') sector, COUNT(*) trades FROM trades tr JOIN issuers i ON i.id=tr.issuer_id
      WHERE tr.politician_id=? GROUP BY sector ORDER BY trades DESC`, req.params.id);
  res.json({ politician: p, trades, summary, topIssuers, bySector });
});

/** GET /api/issuers — companies with trade counts + filters. */
data.get("/issuers", (req, res) => {
  const { q, sector, sort } = req.query as Record<string, string>;
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
     GROUP BY i.id ORDER BY ${order}`, ...p);
  res.json({ rows });
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
data.get("/insights", (req, res) => {
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
