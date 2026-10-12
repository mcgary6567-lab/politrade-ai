import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { Sparkles } from "lucide-react";
import { api, money, ago } from "../lib/api";
import { useAuth } from "../App";
import { compact, partyTone } from "../components/ui";
import { Avatar } from "./Politicians";

export const pill = (t: string) => (t === "buy" ? "pill-buy" : t === "sell" ? "pill-sell" : "pill-ex");

export default function Home() {
  const { user } = useAuth();
  const [d, setD] = useState<any>(null);
  const [assets, setAssets] = useState<"stocks" | "all">("stocks");
  useEffect(() => { api(`/dashboard?assets=${assets}`).then(setD).catch(() => {}); }, [assets]);
  if (!d) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-5">
      {d.window && (
        <div className="card flex flex-wrap items-center gap-3 border-gold/40 bg-gold/5 px-4 py-3 text-sm">
          <span className="flex-1 basis-[260px]"><b className="text-gold">Free plan</b> — showing the last {d.window} days. <b>Pro ($300 / year)</b>: full history since 2014, instant Telegram / WhatsApp / Email alerts, CSV.</span>
          <Link to="/settings" className="btn-gold px-3 py-1.5 text-xs">Upgrade</Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Latest trades */}
        <Panel title="Latest trades" to="/trades" extra={
          <div className="flex rounded-lg border border-line p-0.5 text-xs">
            {(["stocks", "all"] as const).map((k) => <button key={k} onClick={() => setAssets(k)} className={`rounded-md px-2.5 py-1 font-semibold ${assets === k ? "bg-ink-500 text-slate-100" : "text-slate-400"}`}>{k === "stocks" ? "Stocks" : "All assets"}</button>)}
          </div>}>
          <div className="divide-y divide-line">
            {d.latest.map((r: any) => (
              <div key={r.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-sm sm:grid-cols-[64px_1fr_1fr_auto]">
                <div><span className={pill(r.tx_type)}>{r.tx_type.toUpperCase()}</span><div className="mt-1 text-[11px] text-slate-500">{ago(r.published_date)}</div></div>
                <div className="min-w-0"><Link to={`/issuers/${r.issuer_id}`} className="block truncate font-semibold hover:text-gold">{r.issuer}</Link><div className="truncate font-mono text-xs text-gold-300">{r.ticker ?? "—"}<span className="font-sans text-slate-500 sm:hidden"> · {r.politician}</span></div></div>
                <div className="hidden min-w-0 sm:block"><Link to={`/politicians/${r.politician_id}`} className="block truncate font-semibold hover:text-gold">{r.politician}</Link><div className="truncate text-xs text-slate-500">{[r.party, r.chamber, r.state].filter(Boolean).join(" | ")}</div></div>
                <div className="text-right font-mono text-xs text-slate-300">{band(r.amount_min, r.amount_max)}</div>
              </div>
            ))}
            {!d.latest.length && <p className="py-6 text-center text-sm text-slate-500">No trades in this window.</p>}
          </div>
        </Panel>

        {/* Latest insights */}
        <Panel title="Latest insights" to="/insights">
          <div className="divide-y divide-line">
            {d.notable.map((r: any) => (
              <Link key={r.id} to={`/politicians/${r.politician_id}`} className="flex items-start gap-3 py-2.5 hover:bg-ink-700/40">
                <Avatar p={{ name: r.politician, party: r.party, photo_url: r.photo_url }} size="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="text-[11px] text-slate-500">{r.published_date}</div>
                  <div className="truncate font-semibold">{r.politician} <span className={pill(r.tx_type)}>{r.tx_type.toUpperCase()}</span> {r.ticker ? <span className="font-mono text-gold-300">{r.ticker}</span> : r.issuer} · {money(r.amount_min, r.amount_max)}</div>
                  <div className="truncate text-xs text-slate-400">{r.ai_note ?? `${r.issuer}${r.owner ? ` · ${r.owner}` : ""}${r.filed_after_days != null ? ` · filed after ${r.filed_after_days} days` : ""}`}</div>
                </div>
                {r.ai_note && <Sparkles size={14} className="mt-1 shrink-0 text-gold" />}
              </Link>
            ))}
          </div>
        </Panel>

        {/* Featured politicians */}
        <Panel title="Featured politicians" to="/politicians" sub="last 12 months">
          <div className="divide-y divide-line">
            {d.featuredPols.map((p: any) => (
              <div key={p.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar p={p} size="h-10 w-10" />
                  <div className="min-w-0 flex-1 basis-[160px]"><Link to={`/politicians/${p.id}`} className="block truncate font-semibold hover:text-gold">{p.name}</Link>
                    <div className="truncate text-xs"><span className={partyTone(p.party)}>{p.party}</span><span className="text-slate-500"> | {p.chamber} | {p.state}</span></div></div>
                  <div className="grid w-full grid-cols-4 gap-3 sm:w-auto"><Stat n={p.trades} l="Trades" /><Stat n={p.filings} l="Filings" /><Stat n={p.issuers} l="Issuers" /><Stat n={compact(p.volume)} l="Volume" /></div>
                </div>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={p.series} margin={{ top: 8, left: 0, right: 0, bottom: 0 }} barGap={1}>
                    <XAxis dataKey="month" tick={{ fill: "#8a96ad", fontSize: 9 }} tickFormatter={(m) => MON[Number(m.slice(5, 7)) - 1]} axisLine={false} tickLine={false} interval={0} />
                    <Tooltip {...tip} labelFormatter={(m) => m} />
                    <Bar dataKey="buys" fill="#22c58b" barSize={5} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="sells" fill="#e7b23c" barSize={5} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          {/* Featured issuers */}
          <Panel title="Featured issuers" to="/issuers" sub="3 years">
            <div className="divide-y divide-line">
              {d.featuredIssuers.map((i: any) => (
                <Link key={i.id} to={`/issuers/${i.id}`} className="grid grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5 hover:bg-ink-700/40 sm:grid-cols-[40px_1fr_auto_auto_110px]">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-600 font-mono text-[11px] font-700 text-gold">{i.ticker.slice(0, 4)}</span>
                  <div className="min-w-0"><div className="truncate text-sm font-semibold">{i.name}</div><div className="font-mono text-xs text-slate-500">{i.ticker}:US</div></div>
                  <Stat n={i.trades} l="Trades" />
                  <div className="text-right text-xs"><div className="font-mono text-buy">{i.buys}</div><div className="font-mono text-sell">{i.sells}</div></div>
                  <div className="hidden h-9 sm:block"><ResponsiveContainer width="100%" height={36}>
                    <LineChart data={i.series}><Line type="monotone" dataKey="trades" stroke="#22c58b" strokeWidth={1.5} dot={false} /></LineChart>
                  </ResponsiveContainer></div>
                </Link>
              ))}
            </div>
          </Panel>

          {/* States */}
          <Panel title="States" to="/trades" sub="3 years">
            <StateTiles states={d.states} />
            <div className="mt-3 divide-y divide-line">
              {d.states.slice(0, 3).map((s: any) => (
                <Link key={s.state} to={`/trades?state=${s.state}`} className="flex flex-wrap items-center gap-3 py-2.5 text-sm hover:bg-ink-700/40">
                  <span className="w-24 truncate font-semibold">{STATE_NAMES[s.state] ?? s.state}</span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-600 font-mono text-xs text-gold">{s.state}</span>
                  <Stat n={s.trades.toLocaleString()} l="Trades" /><Stat n={s.politicians} l="Politicians" /><Stat n={compact(s.volume)} l="Volume" />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      {user?.role === "admin" && <p className="text-xs text-slate-500">Admin: configure feeds, channels and plans in the <Link to="/admin" className="text-gold">Admin panel</Link>.</p>}
    </div>
  );
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const tip = { contentStyle: { background: "#121a2e", border: "1px solid #223052", borderRadius: 10, color: "#e7ecf5", fontSize: 12 }, cursor: { fill: "rgba(231,178,60,.08)" } } as any;
const band = (a?: number | null, b?: number | null) => a == null ? "—" : `${k(a)}–${k(b ?? a)}`;
const k = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);

function Panel({ title, to, sub, extra, children }: { title: string; to: string; sub?: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card min-w-0 overflow-hidden p-4">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="font-display text-xs font-700 uppercase tracking-wider">{title}</h2>
        {sub && <span className="chip py-0 text-[10px]">{sub}</span>}
        {extra}
        <Link to={to} className="ml-auto text-xs font-semibold text-slate-400 hover:text-gold">View all</Link>
      </div>
      {children}
    </section>
  );
}
const Stat = ({ n, l }: { n: React.ReactNode; l: string }) => <div className="text-right"><div className="font-mono text-sm text-slate-100">{n}</div><div className="text-[10px] uppercase tracking-wide text-slate-500">{l}</div></div>;

/** US tile map (the familiar 11×8 grid of state squares) shaded by trade count; no geo data needed. */
const TILES: Record<string, [number, number]> = {
  AK: [0, 0], ME: [10, 0], VT: [9, 1], NH: [10, 1], WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6], HI: [0, 7], TX: [3, 7], FL: [8, 7],
};
function StateTiles({ states }: { states: any[] }) {
  const by = new Map(states.map((s) => [s.state, s]));
  const max = Math.max(1, ...states.map((s) => s.trades));
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(11, minmax(0, 1fr))" }}>
      {Array.from({ length: 88 }, (_, i) => {
        const x = i % 11, y = Math.floor(i / 11);
        const st = Object.keys(TILES).find((s) => TILES[s][0] === x && TILES[s][1] === y);
        if (!st) return <div key={i} />;
        const s = by.get(st); const t = s ? Math.sqrt(s.trades / max) : 0;
        const lean = s ? (s.rep > s.dem ? "251,113,133" : s.dem > s.rep ? "56,189,248" : "231,178,60") : "36,49,79";
        return (
          <Link key={i} to={`/trades?state=${st}`} title={s ? `${STATE_NAMES[st] ?? st}: ${s.trades.toLocaleString()} trades · ${s.politicians} politicians` : st}
            className="grid aspect-square place-items-center rounded-[3px] text-[9px] font-semibold text-slate-200 transition hover:ring-1 hover:ring-gold"
            style={{ background: `rgba(${lean},${s ? 0.15 + t * 0.85 : 0.35})` }}>{st}</Link>
        );
      })}
    </div>
  );
}
const STATE_NAMES: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "D.C." };
