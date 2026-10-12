import { Router } from "express";
import { all, get } from "../db.js";

export const data = Router();

/** GET /api/trades — filterable, paginated feed. */
data.get("/trades", (req, res) => {
  const { q, type, party, chamber, ticker, politician } = req.query as Record<string, string>;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const where: string[] = []; const p: any[] = [];
  if (type) { where.push("tr.tx_type=?"); p.push(type); }
  if (party) { where.push("p.party=?"); p.push(party); }
  if (chamber) { where.push("p.chamber=?"); p.push(chamber); }
  if (ticker) { where.push("i.ticker=?"); p.push(ticker.toUpperCase()); }
  if (politician) { where.push("tr.politician_id=?"); p.push(Number(politician)); }
  if (q) { where.push("(p.name LIKE ? OR i.name LIKE ? OR i.ticker LIKE ?)"); const s = `%${q}%`; p.push(s, s, s); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = all(
    `SELECT tr.id, tr.tx_type, tr.tx_date, tr.published_date, tr.amount_min, tr.amount_max, tr.filed_after_days, tr.ai_note,
            p.id politician_id, p.name politician, p.party, p.chamber, p.state,
            i.id issuer_id, i.ticker, i.name issuer, i.sector
     FROM trades tr JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id
     ${w} ORDER BY tr.published_date DESC, tr.id DESC LIMIT ? OFFSET ?`, ...p, limit, offset);
  const total = get(`SELECT COUNT(*) c FROM trades tr JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id ${w}`, ...p).c;
  res.json({ rows, total, limit, offset });
});

/** GET /api/politicians — with trade counts. */
data.get("/politicians", (req, res) => {
  const q = (req.query.q as string) || "";
  const rows = all(
    `SELECT p.*, COUNT(tr.id) trades,
            SUM(CASE WHEN tr.tx_type='buy' THEN 1 ELSE 0 END) buys,
            SUM(CASE WHEN tr.tx_type='sell' THEN 1 ELSE 0 END) sells,
            MAX(tr.published_date) last_traded
     FROM politicians p LEFT JOIN trades tr ON tr.politician_id=p.id
     ${q ? "WHERE p.name LIKE ?" : ""}
     GROUP BY p.id ORDER BY trades DESC, p.name`, ...(q ? [`%${q}%`] : []));
  res.json({ rows });
});

data.get("/politicians/:id", (req, res) => {
  const p = get("SELECT * FROM politicians WHERE id=?", req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  const trades = all(
    `SELECT tr.*, i.ticker, i.name issuer, i.sector FROM trades tr JOIN issuers i ON i.id=tr.issuer_id
     WHERE tr.politician_id=? ORDER BY tr.published_date DESC LIMIT 100`, req.params.id);
  res.json({ politician: p, trades });
});

/** GET /api/issuers — companies with trade counts. */
data.get("/issuers", (req, res) => {
  const q = (req.query.q as string) || "";
  const rows = all(
    `SELECT i.*, COUNT(tr.id) trades,
            SUM(CASE WHEN tr.tx_type='buy' THEN 1 ELSE 0 END) buys,
            SUM(CASE WHEN tr.tx_type='sell' THEN 1 ELSE 0 END) sells,
            MAX(tr.published_date) last_traded
     FROM issuers i LEFT JOIN trades tr ON tr.issuer_id=i.id
     ${q ? "WHERE i.name LIKE ? OR i.ticker LIKE ?" : ""}
     GROUP BY i.id ORDER BY trades DESC, i.name`, ...(q ? [`%${q}%`, `%${q}%`] : []));
  res.json({ rows });
});

/** GET /api/insights — aggregates for the dashboard + insights page. */
data.get("/insights", (_req, res) => {
  const totals = get(`SELECT COUNT(*) trades,
      SUM(CASE WHEN tx_type='buy' THEN 1 ELSE 0 END) buys,
      SUM(CASE WHEN tx_type='sell' THEN 1 ELSE 0 END) sells FROM trades`);
  const topIssuers = all(`SELECT i.ticker, i.name, COUNT(tr.id) trades FROM trades tr JOIN issuers i ON i.id=tr.issuer_id
      GROUP BY i.id ORDER BY trades DESC LIMIT 8`);
  const topPols = all(`SELECT p.id, p.name, p.party, COUNT(tr.id) trades FROM trades tr JOIN politicians p ON p.id=tr.politician_id
      GROUP BY p.id ORDER BY trades DESC LIMIT 8`);
  const byParty = all(`SELECT p.party, COUNT(tr.id) trades FROM trades tr JOIN politicians p ON p.id=tr.politician_id
      GROUP BY p.party ORDER BY trades DESC`);
  const bySector = all(`SELECT COALESCE(i.sector,'Other') sector, COUNT(tr.id) trades FROM trades tr JOIN issuers i ON i.id=tr.issuer_id
      GROUP BY sector ORDER BY trades DESC LIMIT 8`);
  const volume = all(`SELECT substr(published_date,1,7) month, COUNT(*) trades FROM trades
      WHERE published_date IS NOT NULL GROUP BY month ORDER BY month DESC LIMIT 12`).reverse();
  res.json({ totals, topIssuers, topPols, byParty, bySector, volume });
});
