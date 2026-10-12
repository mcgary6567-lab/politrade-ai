import { all, get, run } from "./db.js";
import { signalThesis } from "./ai.js";
import { sendAlert, sendToUser } from "./notify.js";
import { integ } from "./settings.js";
import { config } from "./config.js";

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

const RANK = { low: 0, medium: 1, high: 2 } as const;

/**
 * After new filings arrive: find buy signals that are new (or stronger than when last announced) and push them
 * to the platform channels and to every Pro member who opted into signal alerts. Deduped per ticker+direction:
 * a ticker is re-announced only when its confidence tier rises or at least two more lawmakers joined the cluster.
 */
export async function checkSignalAlerts(opts: { days?: number; dryRun?: boolean; force?: boolean } = {}): Promise<{ checked: number; seeded?: number; announced: { ticker: string; score: number; confidence: string; sentTo: number }[] }> {
  const days = opts.days ?? 90;
  const min = RANK[integ.signalMin()] ?? 1;
  const r = computeSignals(days, 20);
  const candidates = r.buy.filter((s) => RANK[s.confidence] >= min);
  const announced: { ticker: string; score: number; confidence: string; sentTo: number }[] = [];
  // very first evaluation on an install with data: record what already exists instead of blasting history at everyone
  if (!opts.force && !opts.dryRun && !get("SELECT 1 FROM signal_alerts LIMIT 1")) {
    for (const sg of candidates) run("INSERT INTO signal_alerts(ticker,direction,confidence,score,buyers,sellers,created_at) VALUES(?,?,?,?,?,?,?)", sg.ticker, sg.direction, sg.confidence, sg.score, sg.buyers, sg.sellers, new Date().toISOString());
    return { checked: candidates.length, seeded: candidates.length, announced };
  }
  const members = all(`SELECT u.id, u.role, u.tg_chat_id, u.wa_to, u.alert_email, p.price_cents, p.active
                       FROM users u LEFT JOIN plans p ON p.id=u.plan_id
                       WHERE u.status='active' AND u.notify=1 AND u.notify_signals=1
                         AND (u.tg_chat_id IS NOT NULL OR u.wa_to IS NOT NULL OR u.alert_email IS NOT NULL)`)
    .filter((u: any) => u.role === "admin" || (u.active && u.price_cents > 0));
  for (const sg of candidates) {
    const last = get("SELECT * FROM signal_alerts WHERE ticker=? AND direction=? ORDER BY id DESC LIMIT 1", sg.ticker, sg.direction);
    const fresh = !last || (Date.now() - Date.parse(last.created_at)) > 30 * 86400000;
    const stronger = last && (RANK[sg.confidence as keyof typeof RANK] > RANK[last.confidence as keyof typeof RANK] || sg.buyers >= last.buyers + 2);
    if (!opts.force && !fresh && !stronger) continue;
    if (opts.dryRun) { announced.push({ ticker: sg.ticker, score: sg.score, confidence: sg.confidence, sentTo: members.length }); continue; }
    await withTheses([sg], 1);
    const id = Number(run("INSERT INTO signal_alerts(ticker,direction,confidence,score,buyers,sellers,created_at) VALUES(?,?,?,?,?,?,?)",
      sg.ticker, sg.direction, sg.confidence, sg.score, sg.buyers, sg.sellers, new Date().toISOString()).lastInsertRowid);
    const { text, subject } = formatSignal(sg, last ? "upgraded" : "new");
    // platform channels (admin's own Telegram / WhatsApp / email)
    if (integ.alertsEnabled()) {
      const res = await sendAlert(text, subject);
      for (const [channel, info] of Object.entries(res)) run("INSERT INTO user_signal_alerts(user_id,signal_id,channel,ok,info,created_at) VALUES(NULL,?,?,?,?,?)", id, channel, info.startsWith("sent") ? 1 : 0, info, new Date().toISOString());
    }
    let sent = 0;
    for (const u of members) {
      const res = await sendToUser(u, text, subject);
      for (const [channel, info] of Object.entries(res)) { run("INSERT INTO user_signal_alerts(user_id,signal_id,channel,ok,info,created_at) VALUES(?,?,?,?,?,?)", u.id, id, channel, info.startsWith("sent") ? 1 : 0, info, new Date().toISOString()); if (info.startsWith("sent")) sent++; }
    }
    announced.push({ ticker: sg.ticker, score: sg.score, confidence: sg.confidence, sentTo: sent });
  }
  return { checked: candidates.length, announced };
}

export function formatSignal(sg: Signal, kind: "new" | "upgraded" | "test" = "new") {
  const brand = integ.brandName();
  const head = kind === "upgraded" ? "⬆️ SIGNAL STRENGTHENED" : kind === "test" ? "🧪 TEST SIGNAL" : "🚦 NEW BUY SIGNAL";
  const buyers = sg.topBuyers.slice(0, 3).map((b) => b.name.replace(/^(Rep|Sen)\. /, "") + (b.hit_rate != null ? ` (${Math.round(b.hit_rate * 100)}%)` : "")).join(", ");
  const text = `<b>${head} · ${sg.ticker}</b> — ${sg.issuer}\n` +
    `Score <b>${sg.score}/100</b> · ${sg.confidence} confidence\n` +
    sg.reasons.slice(0, 4).map((x) => `• ${x}`).join("\n") + "\n" +
    (buyers ? `Buyers: ${buyers}\n` : "") +
    (sg.thesis ? `\n${sg.thesis}\n` : "") +
    `\n${config.publicUrl}/signals\n<i>${brand} · research signal from public filings, not investment advice</i>`;
  return { text, subject: `${brand}: ${kind === "upgraded" ? "stronger" : "new"} buy signal — ${sg.ticker} (${sg.score}/100)` };
}
