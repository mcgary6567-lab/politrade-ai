import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Landmark, Building2, Bell, TrendingUp, Radio } from "lucide-react";
import { api, money, ago } from "../lib/api";
import { useAuth } from "../App";

export default function Home() {
  const { user } = useAuth();
  const [ins, setIns] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [counts, setCounts] = useState<{ pols: number; iss: number } | null>(null);

  useEffect(() => {
    api("/insights").then(setIns).catch(() => {});
    api("/trades?limit=8").then((r: any) => setRecent(r.rows)).catch(() => {});
    api("/alerts/status").then(setStatus).catch(() => {});
    Promise.all([api<any>("/politicians"), api<any>("/issuers")])
      .then(([p, i]) => setCounts({ pols: p.rows.length, iss: i.rows.length })).catch(() => {});
  }, []);

  const t = ins?.totals;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-700">Welcome{user?.name ? `, ${user.name}` : ""}</h1>
        <p className="text-sm text-slate-400">Live overview of publicly disclosed congressional trades.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<ArrowLeftRight size={18} />} label="Total trades" value={num(t?.trades)} to="/trades" />
        <Stat icon={<TrendingUp size={18} />} label="Buys / Sells" value={t ? `${t.buys ?? 0} / ${t.sells ?? 0}` : "…"} to="/trades" />
        <Stat icon={<Landmark size={18} />} label="Politicians" value={num(counts?.pols)} to="/politicians" />
        <Stat icon={<Building2 size={18} />} label="Issuers" value={num(counts?.iss)} to="/issuers" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display font-600">Latest trades</h2>
            <Link to="/trades" className="text-sm font-semibold text-gold hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-line">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3">
                <span className={pill(r.tx_type)}>{r.tx_type.toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.politician} <span className="text-xs font-normal text-slate-500">· {r.party ?? "—"}</span></div>
                  <div className="truncate text-sm text-slate-400">{r.ticker ? <span className="font-mono text-gold-300">{r.ticker}</span> : null} {r.issuer}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{money(r.amount_min, r.amount_max)}</div>
                  <div className="text-xs text-slate-500">{ago(r.published_date)}</div>
                </div>
              </div>
            ))}
            {!recent.length && <p className="py-6 text-center text-sm text-slate-500">Loading…</p>}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-display font-600"><Radio size={16} className="text-gold" /> Alert channels</h2>
            {status ? (
              <ul className="space-y-2 text-sm">
                <ChannelRow on={status.channels.telegram} name="Telegram" />
                <ChannelRow on={status.channels.whatsapp} name="WhatsApp" />
                <ChannelRow on={status.channels.email} name="Email" />
                <li className="flex items-center justify-between pt-1 text-slate-400"><span>AI summaries</span><span className={status.ai ? "text-buy" : "text-slate-500"}>{status.ai ? "on" : "off"}</span></li>
                <li className="flex items-center justify-between text-slate-400"><span>Data feed</span><span className={status.feed.configured ? "text-buy" : "text-slate-500"}>{status.feed.configured ? "connected" : "demo data"}</span></li>
              </ul>
            ) : <p className="text-sm text-slate-500">…</p>}
            <p className="mt-3 text-xs text-slate-500">New disclosures are pushed to connected channels automatically.{user?.role === "admin" && <> <Link to="/admin/integrations" className="text-gold hover:underline">Configure →</Link></>}</p>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-display font-600"><Bell size={16} className="text-gold" /> Most active</h2>
            <ul className="space-y-2 text-sm">
              {ins?.topPols?.slice(0, 5).map((p: any) => (
                <li key={p.id} className="flex items-center justify-between">
                  <Link to={`/politicians/${p.id}`} className="truncate hover:text-gold">{p.name}</Link>
                  <span className="font-mono text-slate-400">{p.trades}</span>
                </li>
              ))}
              {!ins && <li className="text-slate-500">…</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const num = (n?: number) => (n == null ? "…" : n.toLocaleString("en-US"));
export const pill = (t: string) => (t === "buy" ? "pill-buy" : t === "sell" ? "pill-sell" : "pill-ex");

function Stat({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: React.ReactNode; to: string }) {
  return (
    <Link to={to} className="card p-4 transition hover:border-gold/40">
      <div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <div className="mt-2 font-display text-2xl font-700">{value}</div>
    </Link>
  );
}
function ChannelRow({ on, name }: { on: boolean; name: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${on ? "bg-buy" : "bg-slate-600"}`} />{name}</span>
      <span className={on ? "text-buy" : "text-slate-500"}>{on ? "connected" : "not set"}</span>
    </li>
  );
}
