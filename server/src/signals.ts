import { all, get } from "./db.js";
import { signalThesis } from "./ai.js";

/**
 * Smart-money signals computed from the disclosure data itself:
 *  - who is buying / selling a ticker in the recent window, how many of them, how much, from which parties
 *  - weighted by each lawmaker's own track record (hit rate / 6-month excess return from the history dataset)
 * Everything here is a research signal derived from public filings — never investment advice.
 */
export type Signal = {
  ticker: string; issuer: string; issuer_id: number; sector: string | null; direction: "buy" | "sell";
  score: number; confidence: "high" | "medium" | "low";
  buyers: number; sellers: number; volume: number; bipartisan: boolean; lastFiled: string; days: number;
  smart: number; avgExcess: number | null; histHit: number | null; histN: number;
  topBuyers: { id: number; name: string; party: string | null; hit_rate: number | null; amount_max: number | null; published_date: string }[];
  reasons: string[]; thesis?: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function computeSignals(days = 45, limit = 12): { buy: Signal[]; sell: Signal[]; days: number; generatedAt: string } {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rows = all(`SELECT tr.tx_type, tr.amount_max, tr.amount_min, tr.published_date, tr.excess_6m,
                           p.id pid, p.name, p.party, p.hit_rate, p.avg_excess, i.id iid, i.ticker, i.name issuer, i.sector
                    FROM trades tr JOIN politicians p ON p.id=tr.politician_id JOIN issuers i ON i.id=tr.issuer_id
                    WHERE i.ticker IS NOT NULL AND tr.published_date >= ? AND tr.tx_type IN ('buy','sell')`, since);
  const byT = new Map<string, any[]>();
  for (const r of rows) { if (!byT.has(r.ticker)) byT.set(r.ticker, []); byT.get(r.ticker)!.push(r); }

  // historical outcome of congressional buys in this ticker (6-month excess return), where the dataset has it
  const hist = new Map<string, { n: number; hit: number; avg: number }>(all(`SELECT i.ticker, COUNT(*) n, AVG(tr.excess_6m > 0) hit, AVG(tr.excess_6m) avg
      FROM trades tr JOIN issuers i ON i.id=tr.issuer_id WHERE tr.tx_type='buy' AND tr.excess_6m IS NOT NULL GROUP BY i.ticker HAVING n >= 5`).map((r: any) => [r.ticker, r]));

  const out: Signal[] = [];
  for (const [ticker, list] of byT) {
    const buys = list.filter((r) => r.tx_type === "buy"), sells = list.filter((r) => r.tx_type === "sell");
    const buyers = new Set(buys.map((r) => r.pid)), sellers = new Set(sells.map((r) => r.pid));
    if (!buyers.size && !sellers.size) continue;
    const direction: "buy" | "sell" = buyers.size >= sellers.size ? "buy" : "sell";
    const side = direction === "buy" ? buys : sells;
    const n = direction === "buy" ? buyers.size : sellers.size, opp = direction === "buy" ? sellers.size : buyers.size;
    const volume = side.reduce((a, r) => a + (r.amount_max ?? r.amount_min ?? 0), 0);
    const parties = new Set(side.map((r) => r.party).filter(Boolean));
    const bipartisan = parties.has("Democrat") && parties.has("Republican");
    const perPol = new Map<number, any>();
    for (const r of side) { const cur = perPol.get(r.pid); if (!cur || (r.amount_max ?? 0) > (cur.amount_max ?? 0)) perPol.set(r.pid, r); }
    const pols = [...perPol.values()];
    // track-record weight: a 50% hit rate adds nothing, 80% adds 0.6 per lawmaker
    const smart = pols.reduce((a, r) => a + (r.hit_rate != null ? clamp((r.hit_rate - 0.5) * 2, -0.5, 1) : 0), 0);
    const exc = pols.map((r) => r.avg_excess).filter((v) => v != null) as number[];
    const avgExcess = exc.length ? exc.reduce((a, b) => a + b, 0) / exc.length : null;
    const lastFiled = side.map((r) => r.published_date).sort().pop()!;
    const fresh = (Date.now() - Date.parse(lastFiled)) / 86400000;
    const h = hist.get(ticker);

    let score = 0;
    score += clamp(n, 0, 5) / 5 * 40;                                   // breadth of the cluster
    score += clamp(smart, 0, 2) / 2 * 25;                               // quality of who is in it
    score += clamp(Math.log10(Math.max(volume, 1)) - 4, 0, 3) / 3 * 15; // size ($10k → 0, $10M → 15)
    score += bipartisan ? 6 : 0;
    score += fresh <= 7 ? 6 : fresh <= 21 ? 3 : 0;
    score += h ? clamp((h.hit - 0.5) * 2, -1, 1) * 8 : 0;               // how such buys worked out before in this name
    score -= opp * 6;
    score = Math.round(clamp(score, 0, 100));
    if (direction === "sell") score = Math.round(score * 0.8);          // selling is a weaker tell

    const reasons: string[] = [];
    reasons.push(`${n} lawmaker${n > 1 ? "s" : ""} ${direction === "buy" ? "bought" : "sold"} in the last ${days} days${opp ? ` (${opp} on the other side)` : ""}`);
    if (volume >= 1_000_000) reasons.push(`Disclosed ${direction === "buy" ? "buying" : "selling"} up to $${(volume / 1e6).toFixed(1)}M`);
    else if (volume >= 100_000) reasons.push(`Disclosed up to $${Math.round(volume / 1e3)}K`);
    const strong = pols.filter((r) => r.hit_rate != null && r.hit_rate >= 0.6).sort((a, b) => b.hit_rate - a.hit_rate);
    if (strong.length) reasons.push(`${strong.length} ${strong.length > 1 ? "have" : "has a"} strong track record${strong.length > 1 ? "s" : ""} (${strong.slice(0, 2).map((r) => `${r.name.replace(/^(Rep|Sen)\. /, "")} ${Math.round(r.hit_rate * 100)}%`).join(", ")})`);
    if (avgExcess != null && avgExcess > 0.05) reasons.push(`Their buys beat the market by ${Math.round(avgExcess * 100)}% on average over 6 months`);
    if (bipartisan) reasons.push("Bipartisan — both parties are on the same side");
    if (fresh <= 7) reasons.push("Filed within the last week");
    if (h) reasons.push(`Past congressional buys in ${ticker}: ${Math.round(h.hit * 100)}% beat the market after 6 months (${h.n} trades)`);
    if (opp >= 2) reasons.push(`Caveat: ${opp} lawmakers took the opposite side`);

    out.push({
      ticker, issuer: list[0].issuer, issuer_id: list[0].iid, sector: list[0].sector, direction, score,
      confidence: score >= 55 ? "high" : score >= 35 ? "medium" : "low",
      buyers: buyers.size, sellers: sellers.size, volume, bipartisan, lastFiled, days, smart: Math.round(smart * 100) / 100,
      avgExcess, histHit: h ? h.hit : null, histN: h?.n ?? 0,
      topBuyers: pols.sort((a, b) => (b.hit_rate ?? 0) - (a.hit_rate ?? 0) || (b.amount_max ?? 0) - (a.amount_max ?? 0)).slice(0, 4)
        .map((r) => ({ id: r.pid, name: r.name, party: r.party, hit_rate: r.hit_rate, amount_max: r.amount_max, published_date: r.published_date })),
      reasons,
    });
  }
  const buy = out.filter((s) => s.direction === "buy" && s.buyers >= 2).sort((a, b) => b.score - a.score).slice(0, limit);
  const sell = out.filter((s) => s.direction === "sell" && s.sellers >= 2).sort((a, b) => b.score - a.score).slice(0, Math.ceil(limit / 2));
  return { buy, sell, days, generatedAt: new Date().toISOString() };
}

/** Lawmakers ranked by their own historical record (from the dataset's 6-month excess returns). */
export function leaderboard(limit = 10) {
  return all(`SELECT id, name, party, chamber, state, ext_id, photo_url, hit_rate, avg_excess, ann_return, spy_return, sharpe, perf_n,
                     (SELECT MAX(published_date) FROM trades WHERE politician_id=politicians.id) last_traded
              FROM politicians WHERE hit_rate IS NOT NULL AND perf_n >= 10 ORDER BY (hit_rate * 0.6 + COALESCE(avg_excess,0) * 2) DESC LIMIT ?`, limit);
}

const theses = new Map<string, { at: number; text: string }>();
/** Attach an AI/templated thesis to the first few signals (cached an hour per ticker+direction). */
export async function withTheses(sigs: Signal[], n = 5) {
  for (const s of sigs.slice(0, n)) {
    const k = `${s.ticker}|${s.direction}|${s.buyers}|${s.sellers}`;
    const hit = theses.get(k);
    if (hit && Date.now() - hit.at < 3_600_000) { s.thesis = hit.text; continue; }
    s.thesis = await signalThesis({ ticker: s.ticker, issuer: s.issuer, direction: s.direction, buyers: s.buyers, sellers: s.sellers, smart: s.smart, volume: s.volume, bipartisan: s.bipartisan, days: s.days, topBuyers: s.topBuyers });
    theses.set(k, { at: Date.now(), text: s.thesis });
  }
  return sigs;
}

export const marketStats = () => get(`SELECT COUNT(*) n, AVG(excess_6m > 0) hit, AVG(excess_6m) avg FROM trades WHERE tx_type='buy' AND excess_6m IS NOT NULL`);
