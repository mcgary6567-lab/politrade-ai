import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Lock, Sparkles, ShieldAlert, Trophy, Info } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../App";
import { Select, compact, partyTone } from "../components/ui";
import { Avatar } from "./Politicians";

/** Smart-money signals page: which tickers Congress is clustering into, weighted by each lawmaker's track record. */
export default function Signals() {
  const { user } = useAuth();
  const [d, setD] = useState<any>(null);
  const [days, setDays] = useState("90");
  useEffect(() => { setD(null); api(`/signals?days=${days}`).then(setD).catch(() => setD({ buy: [], sell: [], leaderboard: [] })); }, [days]);
  const [branding, setBranding] = useState<any>(null);
  useEffect(() => { if (!user?.pro) fetch("/api/branding").then((r) => r.json()).then(setBranding).catch(() => {}); }, [user?.pro]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-700"><Sparkles size={22} className="text-gold" /> AI Signals</h1>
          <p className="text-sm text-slate-400">Where Congress's smart money is going — buying clusters ranked by breadth, size, freshness and each lawmaker's own track record.</p>
        </div>
        <Select value={days} onChange={setDays} opts={[["30", "Last 30 days"], ["45", "Last 45 days"], ["90", "Last 90 days"], ["180", "Last 6 months"]]} />
      </div>

      {!d ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="card h-48 animate-pulse" />)}</div> : (
        <>
          {d.locked && (
            <div className="card flex flex-wrap items-center gap-3 border-gold/40 bg-gold/5 p-4 text-sm">
              <Lock size={18} className="shrink-0 text-gold" />
              <div className="flex-1 basis-[260px]"><b className="text-gold">Free plan:</b> you can see the #1 signal. <b>Pro ($497 / year)</b> unlocks every buy and sell signal, the full track-record leaderboard, instant alerts the moment a new cluster forms, and the AI thesis on each.</div>
              <a href={`mailto:${branding?.contact ?? ""}?subject=Upgrade to Pro`} className="btn-gold px-3 py-2 text-xs">Upgrade to Pro</a>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Buy clusters" value={d.buy.length} tone="text-buy" sub={`in the last ${d.days} days`} />
            <Kpi label="Sell / caution" value={d.sell.length} tone="text-sell" sub="weaker signal than buys" />
            <Kpi label="Congress buys that beat the market" value={d.stats?.hit != null ? `${Math.round(d.stats.hit * 100)}%` : "—"} tone="text-gold" sub={`over 6 months · ${(d.stats?.n ?? 0).toLocaleString()} buys measured — which is why we weight by who is buying`} />
          </div>

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-600"><TrendingUp size={18} className="text-buy" /> Buy signals</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {d.buy.map((s: any, i: number) => <SignalCard key={i} s={s} rank={i + 1} />)}
              {!d.buy.length && <p className="text-sm text-slate-500">No buying clusters in this window — try a longer range.</p>}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-600"><TrendingDown size={18} className="text-sell" /> Sell / caution</h2>
              <div className="card divide-y divide-line">
                {d.sell.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 text-sm">
                    {s.locked ? <Lock size={14} className="text-gold" /> : <span className="font-mono font-700 text-sell">{s.ticker}</span>}
                    <span className="min-w-0 flex-1 truncate text-slate-300">{s.locked ? "Locked — Pro" : s.issuer}</span>
                    <span className="text-xs text-slate-500">{s.sellers} sellers{s.buyers ? ` · ${s.buyers} buyers` : ""}</span>
                    <Score v={s.score} small />
                  </div>
                ))}
                {!d.sell.length && <p className="p-3 text-sm text-slate-500">No selling clusters.</p>}
              </div>
            </section>
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-600"><Trophy size={18} className="text-gold" /> Best track records</h2>
              <div className="card divide-y divide-line">
                {d.leaderboard.map((p: any, i: number) => (
                  <Link key={p.id} to={`/politicians/${p.id}`} className="flex items-center gap-3 p-3 text-sm hover:bg-ink-700/40">
                    <span className="w-5 font-mono text-slate-500">{i + 1}</span>
                    <Avatar p={p} size="h-8 w-8 text-xs" />
                    <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.name}</div><div className="truncate text-xs"><span className={partyTone(p.party)}>{p.party}</span><span className="text-slate-500"> · {p.perf_n} trades</span></div></div>
                    <div className="text-right"><div className="font-mono text-buy">{Math.round(p.hit_rate * 100)}%</div><div className="text-[10px] uppercase text-slate-500">hit rate</div></div>
                    <div className="hidden text-right sm:block"><div className="font-mono text-gold">{p.avg_excess != null ? `${p.avg_excess > 0 ? "+" : ""}${Math.round(p.avg_excess * 100)}%` : "—"}</div><div className="text-[10px] uppercase text-slate-500">vs market 6m</div></div>
                  </Link>
                ))}
                {d.locked && <div className="flex items-center gap-2 p-3 text-xs text-slate-500"><Lock size={12} className="text-gold" /> Full leaderboard with Pro.</div>}
              </div>
            </section>
          </div>

          <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldAlert size={14} className="mt-0.5 shrink-0" /> Signals are computed from public STOCK Act filings and the historical performance of those filings. They are research leads for your own analysis — not investment advice, not a recommendation to buy or sell, and past performance does not guarantee future results. Lawmakers file up to 45 days after trading, so prices may already have moved.</p>
        </>
      )}
    </div>
  );
}

function SignalCard({ s, rank }: { s: any; rank: number }) {
  if (s.locked) return (
    <div className="card relative overflow-hidden p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-slate-500">#{rank}</span>
        <span className="font-mono text-lg font-700 text-slate-600">•••</span>
        <span className="chip">{s.sector ?? "Stock"}</span>
        <span className="ml-auto text-xs text-slate-500">{s.buyers} buyers</span>
        <Score v={s.score} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-400"><Lock size={14} className="text-gold" /> Ticker, buyers, reasons and AI thesis are for Pro members.</div>
    </div>
  );
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-slate-500">#{rank}</span>
        <Link to={`/issuers/${s.issuer_id}`} className="font-mono text-lg font-700 text-gold hover:underline">{s.ticker}</Link>
        <span className="order-last min-w-0 basis-full truncate text-sm text-slate-300 sm:order-none sm:basis-auto sm:flex-1">{s.issuer}</span>
        <span className={`ml-auto chip py-0 text-[10px] sm:ml-0 ${s.confidence === "high" ? "border-buy/50 text-buy" : s.confidence === "medium" ? "border-gold/50 text-gold" : ""}`}>{s.confidence}</span>
        <Score v={s.score} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span><b className="text-buy">{s.buyers}</b> buyers</span>{s.sellers > 0 && <span><b className="text-sell">{s.sellers}</b> sellers</span>}
        <span>up to <b className="text-slate-200">{compact(s.volume)}</b></span>
        {s.bipartisan && <span className="text-gold">bipartisan</span>}
        <span>last filed {s.lastFiled}</span>
        {s.histHit != null && <span>history: <b className="text-slate-200">{Math.round(s.histHit * 100)}%</b> beat market ({s.histN})</span>}
      </div>
      {s.thesis && <p className="mt-3 flex gap-2 rounded-xl bg-ink-800/70 p-3 text-sm text-slate-200"><Sparkles size={14} className="mt-0.5 shrink-0 text-gold" />{s.thesis}</p>}
      <ul className="mt-3 space-y-1 text-sm text-slate-300">{s.reasons.map((r: string, i: number) => <li key={i} className="flex gap-2"><span className={r.startsWith("Caveat") ? "text-sell" : "text-buy"}>▸</span>{r}</li>)}</ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {s.topBuyers.map((b: any) => (
          <Link key={b.id} to={`/politicians/${b.id}`} className="chip gap-1.5 hover:border-gold/50"><span className={partyTone(b.party)}>●</span>{b.name.replace(/^(Rep|Sen)\. /, "")}{b.hit_rate != null && <span className="text-buy">{Math.round(b.hit_rate * 100)}%</span>}</Link>
        ))}
        <Link to={`/trades?ticker=${s.ticker}&days=${s.days}`} className="ml-auto text-xs font-semibold text-gold hover:underline">See the trades →</Link>
      </div>
    </div>
  );
}

function Score({ v, small }: { v: number; small?: boolean }) {
  const tone = v >= 55 ? "#22c58b" : v >= 35 ? "#e7b23c" : "#8a96ad";
  const r = small ? 14 : 20, c = 2 * Math.PI * r;
  return (
    <svg width={r * 2 + 6} height={r * 2 + 6} className="shrink-0" aria-label={`score ${v}`}>
      <circle cx={r + 3} cy={r + 3} r={r} stroke="#223052" strokeWidth={small ? 3 : 4} fill="none" />
      <circle cx={r + 3} cy={r + 3} r={r} stroke={tone} strokeWidth={small ? 3 : 4} fill="none" strokeDasharray={`${(v / 100) * c} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${r + 3} ${r + 3})`} />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" fill="#e7ecf5" fontSize={small ? 10 : 12} fontWeight={700} fontFamily="ui-monospace, monospace">{v}</text>
    </svg>
  );
}
function Kpi({ label, value, tone, sub }: { label: string; value: React.ReactNode; tone?: string; sub?: string }) {
  return <div className="card p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div><div className={`mt-1 font-display text-2xl font-700 ${tone ?? ""}`}>{value}</div>{sub && <div className="mt-1 flex items-start gap-1 text-xs text-slate-500"><Info size={11} className="mt-0.5 shrink-0" />{sub}</div>}</div>;
}
