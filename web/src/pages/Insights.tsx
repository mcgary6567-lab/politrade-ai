import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Sparkles, BarChart3 } from "lucide-react";
import { api } from "../lib/api";
import { KPI, Select, compact, partyTone } from "../components/ui";

const PARTY: Record<string, string> = { Democrat: "#38bdf8", Republican: "#fb7185", Independent: "#a78bfa" };
const GOLD = "#e7b23c", GRID = "#223052", BUY = "#22c58b", SELL = "#f26a6a";

export default function Insights() {
  const [d, setD] = useState<any>(null);
  const [days, setDays] = useState("");
  useEffect(() => { api(`/insights${days ? `?days=${days}` : ""}`).then(setD).catch(() => {}); }, [days]);
  if (!d) return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="card h-40 animate-pulse" />)}</div>;

  const t = d.totals ?? {}; const buys = t.buys ?? 0, sells = t.sells ?? 0;
  const ratio = sells ? (buys / sells).toFixed(2) : "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 font-display text-2xl font-700"><Sparkles size={22} className="text-gold" /> Insights</h1><p className="text-sm text-slate-400">Patterns across disclosed congressional trades</p></div>
        <Select value={days} onChange={setDays} opts={[["", "All time"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["180", "Last 6 months"], ["365", "Last year"]]} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KPI label="Trades" value={(t.trades ?? 0).toLocaleString()} />
        <KPI label="Buys" value={buys.toLocaleString()} tone="text-buy" />
        <KPI label="Sells" value={sells.toLocaleString()} tone="text-sell" />
        <KPI label="Buy / Sell" value={ratio} tone="text-gold" />
        <KPI label="Est. volume" value={compact(t.volume)} sub="upper bound" />
        <KPI label="Avg filing delay" value={t.avg_delay != null ? `${Math.round(t.avg_delay)}d` : "—"} tone={t.avg_delay > 45 ? "text-sell" : ""} sub="limit 45d" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Buys vs sells per month">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={d.volume} margin={{ left: -18, right: 8, top: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#8a96ad", fontSize: 11 }} tickFormatter={(m) => m?.slice(2)} />
              <YAxis tick={{ fill: "#8a96ad", fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="buys" stackId="a" fill={BUY} barSize={18} />
              <Bar dataKey="sells" stackId="a" fill={SELL} radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Disclosed volume per month (upper bound)">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={d.volume} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#8a96ad", fontSize: 11 }} tickFormatter={(m) => m?.slice(2)} />
              <YAxis tick={{ fill: "#8a96ad", fontSize: 11 }} tickFormatter={(v) => compact(v)} width={56} />
              <Tooltip {...tip} formatter={(v: any) => compact(v)} />
              <Line type="monotone" dataKey="volume" stroke={GOLD} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="By party">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={220}>
              <PieChart>
                <Pie data={d.byParty} dataKey="trades" nameKey="party" innerRadius={50} outerRadius={85} paddingAngle={2} stroke="none">
                  {d.byParty.map((e: any) => <Cell key={e.party} fill={PARTY[e.party] ?? "#64748b"} />)}
                </Pie>
                <Tooltip {...tip} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-2 text-sm">
              {d.byParty.map((e: any) => (
                <li key={e.party}><div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PARTY[e.party] ?? "#64748b" }} />{e.party}</span><span className="font-mono">{e.trades}</span></div>
                  <div className="text-xs text-slate-500"><span className="text-buy">{e.buys} buys</span> · <span className="text-sell">{e.sells} sells</span></div></li>
              ))}
              {d.byChamber?.map((c: any) => <li key={c.chamber} className="flex items-center justify-between border-t border-line pt-2 text-slate-400"><span>{c.chamber}</span><span className="font-mono">{c.trades}</span></li>)}
            </ul>
          </div>
        </Panel>

        <Panel title="Trade size distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.bands} margin={{ left: -18, right: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="band" tick={{ fill: "#8a96ad", fontSize: 10 }} interval={0} />
              <YAxis tick={{ fill: "#8a96ad", fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tip} />
              <Bar dataKey="trades" fill={GOLD} radius={[5, 5, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Most traded issuers">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.topIssuers} layout="vertical" margin={{ left: 20, right: 12 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={{ fill: "#8a96ad", fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="ticker" tick={{ fill: "#e7ecf5", fontSize: 11 }} width={56} />
              <Tooltip {...tip} />
              <Bar dataKey="buys" stackId="a" fill={BUY} barSize={14} />
              <Bar dataKey="sells" stackId="a" fill={SELL} radius={[0, 5, 5, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="By sector">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.bySector} margin={{ left: -18, right: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="sector" tick={{ fill: "#8a96ad", fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fill: "#8a96ad", fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tip} />
              <Bar dataKey="buys" stackId="a" fill={BUY} barSize={26} />
              <Bar dataKey="sells" stackId="a" fill={SELL} radius={[5, 5, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Most active politicians">
          <ol className="space-y-2 text-sm">
            {d.topPols.map((p: any, i: number) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="w-5 text-right font-mono text-slate-500">{i + 1}</span>
                <Link to={`/politicians/${p.id}`} className="flex-1 truncate hover:text-gold"><span className={`mr-1 ${partyTone(p.party)}`}>●</span>{p.name} <span className="text-xs text-slate-500">· {p.chamber}</span></Link>
                <span className="font-mono text-slate-300">{compact(p.volume)}</span>
                <span className="w-10 text-right font-mono text-gold">{p.trades}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Slowest filers (avg days to disclose)">
          <ul className="space-y-2 text-sm">
            {d.lateFilers?.map((p: any) => (
              <li key={p.id} className="flex items-center gap-3">
                <Link to={`/politicians/${p.id}`} className="flex-1 truncate hover:text-gold"><span className={`mr-1 ${partyTone(p.party)}`}>●</span>{p.name}</Link>
                <div className="h-2 w-28 overflow-hidden rounded-full bg-ink-800"><div className={`h-full ${p.avg_delay > 45 ? "bg-sell" : "bg-gold"}`} style={{ width: `${Math.min(100, p.avg_delay / 1.2)}%` }} /></div>
                <span className={`w-12 text-right font-mono ${p.avg_delay > 45 ? "text-sell" : ""}`}>{p.avg_delay}d</span>
              </li>
            ))}
            {!d.lateFilers?.length && <li className="text-slate-500">Not enough data.</li>}
          </ul>
          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Top states</h3>
          <div className="flex flex-wrap gap-1.5">{d.byState?.map((s: any) => <Link key={s.state} to={`/trades?state=${s.state}`} className="chip hover:border-gold/50">{s.state} <span className="text-gold">{s.trades}</span></Link>)}</div>
        </Panel>
      </div>

      <div className="card flex items-start gap-3 p-4 text-sm text-slate-300">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-gold" />
        <p>AI writes a one-line summary for every new disclosure and (when channels are connected) pushes it to Telegram, WhatsApp and email the moment a lawmaker's trade is filed. Amounts are disclosed as ranges; “volume” uses the upper bound.</p>
      </div>
    </div>
  );
}

const tip = { contentStyle: { background: "#121a2e", border: "1px solid #223052", borderRadius: 10, color: "#e7ecf5" }, cursor: { fill: "rgba(231,178,60,.08)" } } as any;
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-4"><h2 className="mb-3 flex items-center gap-2 font-display font-600"><BarChart3 size={15} className="text-gold" /> {title}</h2>{children}</div>;
}
