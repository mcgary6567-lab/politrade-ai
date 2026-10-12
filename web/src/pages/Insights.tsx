import { useEffect, useState } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Sparkles } from "lucide-react";
import { api } from "../lib/api";

const PARTY: Record<string, string> = { Democrat: "#38bdf8", Republican: "#fb7185", Independent: "#a78bfa" };
const GOLD = "#e7b23c", GRID = "#223052";

export default function Insights() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api("/insights").then(setD).catch(() => {}); }, []);
  if (!d) return <p className="text-slate-500">Loading…</p>;

  const buys = d.totals?.buys ?? 0, sells = d.totals?.sells ?? 0;
  const ratio = sells ? (buys / sells).toFixed(2) : "—";

  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-700">Insights</h1><p className="text-sm text-slate-400">Patterns across disclosed congressional trades</p></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Total trades" value={d.totals?.trades?.toLocaleString() ?? "—"} />
        <KPI label="Buys" value={buys.toLocaleString()} tone="text-buy" />
        <KPI label="Sells" value={sells.toLocaleString()} tone="text-sell" />
        <KPI label="Buy / Sell ratio" value={ratio} tone="text-gold" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Trades per month">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.volume} margin={{ left: -18, right: 8, top: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#8a96ad", fontSize: 11 }} tickFormatter={(m) => m?.slice(2)} />
              <YAxis tick={{ fill: "#8a96ad", fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tip} />
              <Line type="monotone" dataKey="trades" stroke={GOLD} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="By party">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={d.byParty} dataKey="trades" nameKey="party" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                {d.byParty.map((e: any) => <Cell key={e.party} fill={PARTY[e.party] ?? "#64748b"} />)}
              </Pie>
              <Tooltip {...tip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3 text-sm">
            {d.byParty.map((e: any) => <span key={e.party} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PARTY[e.party] ?? "#64748b" }} />{e.party ?? "Other"} ({e.trades})</span>)}
          </div>
        </Panel>

        <Panel title="Most traded issuers">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.topIssuers} layout="vertical" margin={{ left: 20, right: 12 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={{ fill: "#8a96ad", fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="ticker" tick={{ fill: "#e7ecf5", fontSize: 11 }} width={56} />
              <Tooltip {...tip} />
              <Bar dataKey="trades" fill={GOLD} radius={[0, 5, 5, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="By sector">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.bySector} margin={{ left: -18, right: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="sector" tick={{ fill: "#8a96ad", fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fill: "#8a96ad", fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tip} />
              <Bar dataKey="trades" fill="#5b8def" radius={[5, 5, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="card flex items-start gap-3 p-4 text-sm text-slate-300">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-gold" />
        <p>AI writes a one-line summary for every new disclosure and (when channels are connected) pushes it to Telegram, WhatsApp and email the moment a lawmaker's trade is filed. Connect a live data feed to replace the demo sample.</p>
      </div>
    </div>
  );
}

const tip = { contentStyle: { background: "#121a2e", border: "1px solid #223052", borderRadius: 10, color: "#e7ecf5" }, cursor: { fill: "rgba(231,178,60,.08)" } } as any;

function KPI({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="card p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div><div className={`mt-1.5 font-display text-2xl font-700 ${tone ?? ""}`}>{value}</div></div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-4"><h2 className="mb-3 font-display font-600">{title}</h2>{children}</div>;
}
