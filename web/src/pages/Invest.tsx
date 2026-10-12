import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Wallet, Lock, Sparkles, ShieldAlert, Calculator, PiggyBank, BadgeDollarSign, Info } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../App";
import { compact, partyTone } from "../components/ui";

/**
 * Invest Plan: what the back-test says about following congressional "smart clusters", a calculator that projects a
 * member's own numbers under market vs. signal-following scenarios, and a model allocation across today's signals.
 */
export default function Invest() {
  const { user } = useAuth();
  const [d, setD] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  useEffect(() => { api("/invest").then(setD).catch(() => {}); fetch("/api/branding").then((r) => r.json()).then(setBranding).catch(() => {}); }, []);
  const [amount, setAmount] = useState(10000);
  const [monthly, setMonthly] = useState(500);
  const [months, setMonths] = useState(36);

  const sim = useMemo(() => {
    if (!d) return null;
    const annMarket = d.strategy.market.annual, annSmart = d.strategy.smart.annual, annAll = d.strategy.all.annual;
    const m = (a: number) => Math.pow(1 + a, 1 / 12) - 1;
    const rows: any[] = []; let vM = amount, vS = amount, vA = amount, contributed = amount;
    rows.push({ month: 0, market: vM, signals: vS, contributed });
    for (let i = 1; i <= months; i++) {
      vM = vM * (1 + m(annMarket)) + monthly; vS = vS * (1 + m(annSmart)) + monthly; vA = vA * (1 + m(annAll)) + monthly; contributed += monthly;
      rows.push({ month: i, market: Math.round(vM), signals: Math.round(vS), contributed });
    }
    const years = months / 12, proCost = (d.proPriceCents / 100) * Math.max(1, Math.ceil(years));
    const edge = vS - vM;
    const monthlyEdge = edge / Math.max(1, months);
    return { rows, vM, vS, vA, contributed, edge, proCost, paybackMonths: monthlyEdge > 0 ? Math.ceil((d.proPriceCents / 100) / monthlyEdge) : null, annMarket, annSmart };
  }, [d, amount, monthly, months]);

  if (!d || !sim) return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="card h-44 animate-pulse" />)}</div>;
  const s = d.strategy;
  const pct = (v: number, d = 1) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;
  const usd = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-700"><Wallet size={22} className="text-gold" /> Invest Plan</h1>
          <p className="text-sm text-slate-400">What following Congress's smart money has been worth historically, what it could mean for your money, and where the signals point today.</p>
        </div>
        <span className="chip">Back-test {s.measuredFrom?.slice(0, 4)}–{s.measuredTo?.slice(0, 4)} · {s.all.n.toLocaleString()} buys measured</span>
      </div>

      {/* Evidence */}
      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Market (S&P 500)" v={pct(s.market.ret6)} sub={`per 6 months · ≈ ${pct(s.market.annual, 0)} / yr`} />
        <Stat label="Any Congress buy" v={pct(s.all.ret6)} sub={`${Math.round(s.all.hit * 100)}% beat the market`} />
        <Stat label="Cluster buys (2+ lawmakers)" v={pct(s.cluster.ret6)} sub={`${Math.round(s.cluster.hit * 100)}% beat the market · ${s.cluster.n.toLocaleString()} trades`} tone="text-gold" />
        <Stat label="Smart clusters = our signals" v={pct(s.smart.ret6)} sub={`${Math.round(s.smart.hit * 100)}% beat the market · ≈ ${pct(s.smart.annual, 0)} / yr · ${s.smart.n.toLocaleString()} trades`} tone="text-buy" highlight />
      </section>
      <p className="-mt-3 flex items-start gap-2 text-xs text-slate-500"><Info size={13} className="mt-0.5 shrink-0" /> "Smart cluster" = a buy where at least one other lawmaker bought the same stock within 45 days and a buyer has a ≥55% track record — the same rule our AI Signals use. Returns are the average 6-month move of those stocks after the trade date, equal-weighted, before costs.</p>

      {/* Calculator */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-600"><Calculator size={18} className="text-gold" /> Your projection</h2>
        <p className="text-sm text-slate-400">Move the sliders. The two lines apply the historical averages above to your numbers, compounding monthly.</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <Slider label="Starting investment" v={amount} set={setAmount} min={500} max={200000} step={500} fmt={usd} />
            <Slider label="Added every month" v={monthly} set={setMonthly} min={0} max={5000} step={50} fmt={usd} />
            <Slider label="Time horizon" v={months} set={setMonths} min={6} max={120} step={6} fmt={(v) => `${v} months (${(v / 12).toFixed(1)} yrs)`} />
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <Box label="You put in" v={usd(sim.contributed)} />
              <Box label="Market path" v={usd(sim.vM)} />
              <Box label="Following AI signals" v={usd(sim.vS)} tone="text-buy" />
              <Box label="Extra vs market" v={(sim.edge >= 0 ? "+" : "") + usd(sim.edge)} tone={sim.edge >= 0 ? "text-gold" : "text-sell"} />
            </div>
          </div>
          <div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={sim.rows} margin={{ left: 8, right: 8, top: 10 }}>
                <defs>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c58b" stopOpacity={0.5} /><stop offset="100%" stopColor="#22c58b" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8a96ad" stopOpacity={0.4} /><stop offset="100%" stopColor="#8a96ad" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#223052" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#8a96ad", fontSize: 11 }} tickFormatter={(m) => (m % 12 === 0 ? `${m / 12}y` : "")} interval={0} />
                <YAxis tick={{ fill: "#8a96ad", fontSize: 11 }} tickFormatter={(v) => compact(v)} width={60} />
                <Tooltip contentStyle={{ background: "#121a2e", border: "1px solid #223052", borderRadius: 10, color: "#e7ecf5", fontSize: 12 }} formatter={(v: any) => usd(v)} labelFormatter={(m) => `Month ${m}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="contributed" name="Contributed" stroke="#223052" fill="none" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="market" name={`Market (${pct(sim.annMarket, 0)}/yr)`} stroke="#8a96ad" fill="url(#gM)" strokeWidth={2} />
                <Area type="monotone" dataKey="signals" name={`AI signals (${pct(sim.annSmart, 0)}/yr)`} stroke="#22c58b" fill="url(#gS)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Pro ROI */}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-gold/40 bg-gold/5 p-4">
          <BadgeDollarSign size={28} className="shrink-0 text-gold" />
          <div className="flex-1 basis-[280px] text-sm">
            <b className="text-gold">Pro costs ${(d.proPriceCents / 100).toFixed(0)} / year.</b>{" "}
            {sim.paybackMonths && sim.paybackMonths <= months
              ? <>At these numbers the historical edge over the market is about <b>{usd(sim.edge / Math.max(1, months))} per month</b> — the membership would have paid for itself in <b>~{sim.paybackMonths} month{sim.paybackMonths > 1 ? "s" : ""}</b>, and the projected extra over {months} months is <b className="text-buy">{usd(sim.edge)}</b> against <b>{usd(sim.proCost)}</b> of fees.</>
              : <>At this investment size the historical edge is smaller than the fee — Pro makes most sense from roughly <b>{usd(Math.max(2000, Math.ceil((d.proPriceCents / 100) / Math.max(0.005, (Math.pow(1 + sim.annSmart, 1) - Math.pow(1 + sim.annMarket, 1))) / 1000) * 1000))}</b> invested.</>}
          </div>
          {!user?.pro && <a href={`mailto:${branding?.contact ?? ""}?subject=Upgrade to Pro`} className="btn-gold">Upgrade to Pro</a>}
        </div>
      </section>

      {/* Model portfolio */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-600"><PiggyBank size={18} className="text-gold" /> Where the signals point today</h2>
          <span className="text-sm text-slate-400">— how {usd(amount)} would be split across the current buy signals, weighted by score</span>
          <Link to="/signals" className="ml-auto text-xs font-semibold text-gold hover:underline">Full signal detail →</Link>
        </div>
        <ul className="divide-y divide-line md:hidden">
          {d.portfolio.map((p: any) => (
            <li key={p.rank} className={`flex items-center gap-3 p-3.5 ${p.locked ? "opacity-70" : ""}`}>
              <span className="w-5 shrink-0 font-mono text-sm text-slate-500">{p.rank}</span>
              <div className="min-w-0 flex-1">
                {p.locked ? <span className="flex items-center gap-2 text-sm text-slate-500"><Lock size={13} className="text-gold" /> Pro members only</span>
                  : <><Link to={`/issuers/${p.issuer_id}`} className="font-mono font-700 text-gold hover:underline">{p.ticker}</Link><div className="truncate text-xs text-slate-400">{p.issuer}</div></>}
                <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-slate-400">
                  <span className={`chip py-0 text-[10px] ${p.confidence === "high" ? "border-buy/50 text-buy" : p.confidence === "medium" ? "border-gold/50 text-gold" : ""}`}>{p.score}/100</span>
                  <span>{p.buyers} buying{p.bipartisan ? " · bipartisan" : ""}</span>
                  {p.histHit != null && <span className={p.histHit >= 0.5 ? "text-buy" : ""}>{Math.round(p.histHit * 100)}% beat mkt</span>}
                </div>
              </div>
              <div className="shrink-0 text-right"><div className="font-mono text-sm text-slate-100">{usd(amount * p.weight / 100)}</div><div className="text-xs text-slate-500">{p.weight}%</div></div>
            </li>
          ))}
          {!d.portfolio.length && <li className="p-8 text-center text-sm text-slate-500">No buying clusters right now.</li>}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line"><tr><th className="th">#</th><th className="th">Stock</th><th className="th">Signal</th><th className="th text-right">Weight</th><th className="th text-right">Amount</th><th className="th">Lawmakers</th><th className="th">Past buys here</th><th className="th">Top buyer</th></tr></thead>
            <tbody className="divide-y divide-line">
              {d.portfolio.map((p: any) => (
                <tr key={p.rank} className={p.locked ? "opacity-70" : "hover:bg-ink-700/40"}>
                  <td className="td font-mono text-slate-500">{p.rank}</td>
                  <td className="td">{p.locked ? <span className="flex items-center gap-2 text-slate-500"><Lock size={13} className="text-gold" /> Pro members only</span> : <><Link to={`/issuers/${p.issuer_id}`} className="font-mono font-700 text-gold hover:underline">{p.ticker}</Link><div className="text-xs text-slate-400">{p.issuer}</div></>}</td>
                  <td className="td"><span className={`chip py-0 text-[10px] ${p.confidence === "high" ? "border-buy/50 text-buy" : p.confidence === "medium" ? "border-gold/50 text-gold" : ""}`}>{p.score}/100</span></td>
                  <td className="td text-right font-mono">{p.weight}%</td>
                  <td className="td text-right font-mono text-slate-100">{usd(amount * p.weight / 100)}</td>
                  <td className="td text-xs text-slate-300">{p.buyers} buying{p.bipartisan ? " · bipartisan" : ""}</td>
                  <td className="td text-xs text-slate-300">{p.histHit != null ? <span className={p.histHit >= 0.5 ? "text-buy" : "text-slate-400"}>{Math.round(p.histHit * 100)}% beat market</span> : "—"}</td>
                  <td className="td text-xs">{p.topBuyer ? <span><span className={partyTone(undefined)}>{p.topBuyer.name.replace(/^(Rep|Sen)\. /, "")}</span>{p.topBuyer.hit_rate != null && <span className="ml-1 text-buy">{Math.round(p.topBuyer.hit_rate * 100)}%</span>}</span> : "—"}</td>
                </tr>
              ))}
              {!d.portfolio.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={8}>No buying clusters right now.</td></tr>}
            </tbody>
          </table>
        </div>
        {d.locked && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line bg-gold/5 p-4 text-sm">
            <Sparkles size={18} className="shrink-0 text-gold" />
            <div className="flex-1 basis-[260px]">You are seeing 1 of {d.portfolio.length} positions. <b>Pro</b> shows every stock in the plan, the AI thesis behind each, and sends you an alert the moment a new cluster forms — so you act on the same day, not weeks later.</div>
            <a href={`mailto:${branding?.contact ?? ""}?subject=Upgrade to Pro`} className="btn-gold px-3 py-2 text-xs">Unlock the full plan — $300 / year</a>
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldAlert size={14} className="mt-0.5 shrink-0" /> This page is an educational projection, not investment advice or a promise of returns. The back-test applies today's track records to past trades (which flatters results), ignores fees, taxes and the 45-day filing delay, and past performance does not guarantee future results. Stocks can lose value, including all of your capital. Decide for yourself or with a licensed adviser.</p>
    </div>
  );
}

function Stat({ label, v, sub, tone, highlight }: { label: string; v: string; sub: string; tone?: string; highlight?: boolean }) {
  return <div className={`card p-4 ${highlight ? "border-buy/50 bg-buy/5" : ""}`}><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div><div className={`mt-1 font-display text-2xl font-700 ${tone ?? ""}`}>{v}</div><div className="mt-1 text-xs text-slate-500">{sub}</div></div>;
}
function Slider({ label, v, set, min, max, step, fmt }: { label: string; v: number; set: (n: number) => void; min: number; max: number; step: number; fmt: (n: number) => string }) {
  return <label className="block"><div className="flex justify-between text-sm"><span className="text-slate-400">{label}</span><b className="font-mono">{fmt(v)}</b></div><input type="range" className="mt-1 w-full accent-[#e7b23c]" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} /></label>;
}
function Box({ label, v, tone }: { label: string; v: string; tone?: string }) {
  return <div className="rounded-xl border border-line bg-ink-800/60 p-2.5"><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div><div className={`font-mono text-sm font-700 ${tone ?? "text-slate-100"}`}>{v}</div></div>;
}
