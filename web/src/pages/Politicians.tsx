import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search, ArrowLeft } from "lucide-react";
import { api, money, ago } from "../lib/api";
import { pill } from "./Home";

export default function Politicians() {
  const { id } = useParams();
  return id ? <Detail id={id} /> : <List />;
}

const partyTone = (p?: string) => p === "Democrat" ? "text-sky-400" : p === "Republican" ? "text-rose-400" : "text-slate-300";

function List() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => api<any>(`/politicians${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) => setRows(r.rows)).finally(() => setLoading(false)), 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-700">Politicians</h1><p className="text-sm text-slate-400">Lawmakers ranked by disclosed trades</p></div>
      <div className="relative max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
        <input className="input pl-9" placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <Link key={p.id} to={`/politicians/${p.id}`} className="card p-4 transition hover:border-gold/40">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-600">{p.name}</h3>
              <span className="font-mono text-lg text-gold">{p.trades}</span>
            </div>
            <div className="mt-1 text-sm"><span className={partyTone(p.party)}>{p.party ?? "—"}</span> <span className="text-slate-500">· {p.chamber ?? "—"} {p.state ? `· ${p.state}` : ""}</span></div>
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
              <span className="text-buy">{p.buys ?? 0} buys</span><span className="text-sell">{p.sells ?? 0} sells</span>
              <span className="ml-auto">{ago(p.last_traded)}</span>
            </div>
          </Link>
        ))}
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && !rows.length && <p className="text-sm text-slate-500">No politicians found.</p>}
      </div>
    </div>
  );
}

function Detail({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api(`/politicians/${id}`).then(setData).catch(() => setData({ error: true })); }, [id]);
  if (!data) return <p className="text-slate-500">Loading…</p>;
  if (data.error) return <p className="text-slate-500">Not found. <Link to="/politicians" className="text-gold">Back</Link></p>;
  const p = data.politician;
  return (
    <div className="space-y-5">
      <Link to="/politicians" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-gold"><ArrowLeft size={15} /> All politicians</Link>
      <div className="card p-5">
        <h1 className="font-display text-2xl font-700">{p.name}</h1>
        <p className="mt-1"><span className={partyTone(p.party)}>{p.party ?? "—"}</span> <span className="text-slate-500">· {p.chamber ?? "—"} {p.state ? `· ${p.state}` : ""}</span></p>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-display font-600">Trade history ({data.trades.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-line"><tr><th className="th">Issuer</th><th className="th">Type</th><th className="th text-right">Amount</th><th className="th">Traded</th><th className="th">Published</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.trades.map((t: any) => (
                <tr key={t.id} className="hover:bg-ink-700/40">
                  <td className="td"><span className="font-mono text-gold-300">{t.ticker ?? ""}</span> <span className="text-sm text-slate-300">{t.issuer}</span></td>
                  <td className="td"><span className={pill(t.tx_type)}>{t.tx_type.toUpperCase()}</span></td>
                  <td className="td text-right font-mono">{money(t.amount_min, t.amount_max)}</td>
                  <td className="td text-sm text-slate-300">{t.tx_date ?? "—"}</td>
                  <td className="td text-sm text-slate-400">{ago(t.published_date)}</td>
                </tr>
              ))}
              {!data.trades.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={5}>No trades on record.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
