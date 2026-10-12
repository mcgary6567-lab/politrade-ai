import { all } from "./db.js";

/**
 * Historical back-test of "follow the clusters": for every disclosed BUY with a measured 6-month return we check
 * whether, in the 45 days before it, at least one other lawmaker had also bought the same ticker (a cluster) and
 * whether the buyers had a track record (hit rate ≥ 55%). We then compare average 6-month returns of
 * market ≈ (return − excess), all buys, cluster buys and smart-cluster buys. Pure arithmetic on public data.
 */
export type StrategyStats = {
  n: number; ret6: number; excess6: number; hit: number; annual: number;
};
export type Strategy = {
  asOf: string; measuredFrom: string; measuredTo: string;
  market: StrategyStats; all: StrategyStats; cluster: StrategyStats; smart: StrategyStats; topDecile: StrategyStats;
};

const agg = (rows: { r: number; e: number }[]): StrategyStats => {
  const n = rows.length;
  if (!n) return { n: 0, ret6: 0, excess6: 0, hit: 0, annual: 0 };
  const ret6 = rows.reduce((a, x) => a + x.r, 0) / n, excess6 = rows.reduce((a, x) => a + x.e, 0) / n;
  return { n, ret6, excess6, hit: rows.filter((x) => x.e > 0).length / n, annual: Math.pow(1 + ret6, 2) - 1 };
};

let cache: { at: number; v: Strategy } | null = null;
export function strategyStats(): Strategy {
  if (cache && Date.now() - cache.at < 3_600_000) return cache.v;
  const buys = all(`SELECT tr.tx_date d, tr.ret_6m r, tr.excess_6m e, tr.politician_id pid, i.ticker t, p.hit_rate h
                    FROM trades tr JOIN issuers i ON i.id=tr.issuer_id JOIN politicians p ON p.id=tr.politician_id
                    WHERE tr.tx_type='buy' AND tr.ret_6m IS NOT NULL AND tr.excess_6m IS NOT NULL AND i.ticker IS NOT NULL AND tr.tx_date IS NOT NULL
                    ORDER BY i.ticker, tr.tx_date`);
  const market: { r: number; e: number }[] = [], allB: { r: number; e: number }[] = [], cl: { r: number; e: number }[] = [], sm: { r: number; e: number }[] = [];
  let i = 0;
  while (i < buys.length) {
    let j = i; while (j < buys.length && buys[j].t === buys[i].t) j++;
    const grp = buys.slice(i, j);
    for (let k = 0; k < grp.length; k++) {
      const b = grp[k]; const t0 = Date.parse(b.d);
      const others = new Set<number>(); let strong = (b.h ?? 0) >= 0.55;
      for (let m = k - 1; m >= 0; m--) { const o = grp[m]; if (t0 - Date.parse(o.d) > 45 * 86400000) break; if (o.pid !== b.pid) { others.add(o.pid); if ((o.h ?? 0) >= 0.55) strong = true; } }
      const row = { r: b.r, e: b.e };
      market.push({ r: b.r - b.e, e: 0 }); allB.push(row);
      if (others.size >= 1) { cl.push(row); if (strong && others.size >= 1) sm.push(row); }
    }
    i = j;
  }
  const sorted = [...allB].sort((a, b) => b.r - a.r);
  const v: Strategy = {
    asOf: new Date().toISOString(), measuredFrom: buys[0]?.d ?? "", measuredTo: buys[buys.length - 1]?.d ?? "",
    market: agg(market), all: agg(allB), cluster: agg(cl), smart: agg(sm), topDecile: agg(sorted.slice(0, Math.max(1, Math.floor(sorted.length / 10)))),
  };
  // measuredTo should be the latest trade date overall
  v.measuredTo = buys.reduce((m, b) => (b.d > m ? b.d : m), "");
  v.measuredFrom = buys.reduce((m, b) => (b.d < m ? b.d : m), buys[0]?.d ?? "");
  cache = { at: Date.now(), v };
  return v;
}
