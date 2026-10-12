import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Search, ArrowLeft } from "lucide-react";
import { api, money, ago } from "../lib/api";
import { pill } from "./Home";
import { Select, KPI, partyTone, compact } from "../components/ui";

export default function Politicians() {
  const { id } = useParams();
  return id ? <Detail id={id} /> : <List />;
}

function List() {
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const get = (k: string) => sp.get(k) ?? "";
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };
  const deps = ["q", "party", "chamber", "state", "sort"].map(get).join("|");

  useEffect(() => { api("/filters").then(setFilters).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams(); for (const k of ["q", "party", "chamber", "state", "sort"]) if (get(k)) p.set(k, get(k));
    const t = setTimeout(() => api<any>(`/politicians?${p}`).then((r) => setRows(r.rows)).finally(() => setLoading(false)), 200);
    return () => clearTimeout(t);
  }, [deps]); // eslint-disable-line react-hooks/exhaustive-deps
  const opt = (arr?: string[], all = "All") => [["", all], ...(arr ?? []).map((v) => [v, v])] as [string, string][];

  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-700">Politicians</h1><p className="text-sm text-slate-400">{rows.length} lawmakers · ranked by disclosed trades</p></div>
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
          <input className="input pl-9" placeholder="Search by name…" value={get("q")} onChange={(e) => set("q", e.target.value)} />
        </div>
        <Select value={get("party")} onChange={(v) => set("party", v)} opts={opt(filters?.parties, "All parties")} />
        <Select value={get("chamber")} onChange={(v) => set("chamber", v)} opts={opt(filters?.chambers, "Both chambers")} />
        <Select value={get("state")} onChange={(v) => set("state", v)} opts={opt(filters?.states, "All states")} />
        <Select value={get("sort")} onChange={(v) => set("sort", v)} opts={[["", "Most trades"], ["volume", "Largest volume"], ["recent", "Most recent"], ["name", "Name A–Z"]]} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p, idx) => (
          <Link key={p.id} to={`/politicians/${p.id}`} className="card p-4 transition hover:border-gold/40">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-600 font-display font-700 ${partyTone(p.party)}`}>{initials(p.name)}</span>
                <div><h3 className="font-display font-600 leading-tight">{p.name}</h3>
                  <div className="text-xs"><span className={partyTone(p.party)}>{p.party ?? "—"}</span> <span className="text-slate-500">· {p.chamber ?? "—"} {p.state ? `· ${p.state}` : ""}</span></div></div>
              </div>
              <span className="text-xs text-slate-500">#{idx + 1}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-ink-800 py-1.5"><div className="font-mono text-base text-gold">{p.trades}</div>trades</div>
              <div className="rounded-lg bg-ink-800 py-1.5"><div className="font-mono text-base text-slate-200">{compact(p.volume)}</div>volume</div>
              <div className="rounded-lg bg-ink-800 py-1.5"><div className="font-mono text-base text-slate-200">{p.issuers}</div>issuers</div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
              <span className="text-buy">{p.buys ?? 0} buys</span><span className="text-sell">{p.sells ?? 0} sells</span>
              <span className="ml-auto">last {ago(p.last_traded)}</span>
            </div>
          </Link>
        ))}
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && !rows.length && <p className="text-sm text-slate-500">No politicians match.</p>}
      </div>
    </div>
  );
}

const initials = (n: string) => n.replace(/^(Rep|Sen)\.\s*/, "").split(" ").map((x) => x[0]).slice(0, 2).join("");

function Detail({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [type, setType] = useState("");
  useEffect(() => { setData(null); api(`/politicians/${id}`).then(setData).catch(() => setData({ error: true })); }, [id]);
  if (!data) return <p className="text-slate-500">Loading…</p>;
  if (data.error) return <p className="text-slate-500">Not found. <Link to="/politicians" className="text-gold">Back</Link></p>;
  const p = data.politician, s = data.summary ?? {};
  const trades = data.trades.filter((t: any) => !type || t.tx_type === type);
  return (
    <div className="space-y-5">
      <Link to="/politicians" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-gold"><ArrowLeft size={15} /> All politicians</Link>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <span className={`grid h-16 w-16 place-items-center rounded-full bg-ink-600 font-display text-xl font-700 ${partyTone(p.party)}`}>{initials(p.name)}</span>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-700">{p.name}</h1>
          <p className="mt-1"><span className={partyTone(p.party)}>{p.party ?? "—"}</span> <span className="text-slate-500">· {p.chamber ?? "—"} {p.state ? `· ${p.state}` : ""}</span></p>
        </div>
        <Link to={`/trades?politician=${p.id}`} className="btn-ghost text-sm">Open in Trades →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPI label="Trades" value={s.trades ?? 0} />
        <KPI label="Buys / Sells" value={<><span className="text-buy">{s.buys ?? 0}</span> / <span className="text-sell">{s.sells ?? 0}</span></>} />
        <KPI label="Est. volume" value={compact(s.volume)} tone="text-gold" sub="upper bound of ranges" />
        <KPI label="Issuers" value={s.issuers ?? 0} />
        <KPI label="Avg filing delay" value={s.avg_delay != null ? `${Math.round(s.avg_delay)}d` : "—"} tone={s.avg_delay > 45 ? "text-sell" : ""} sub="STOCK Act limit 45d" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-4">
          <h2 className="mb-3 font-display font-600">Favourite issuers</h2>
          <ul className="space-y-2 text-sm">
            {data.topIssuers?.map((i: any) => <li key={i.ticker + i.name} className="flex items-center justify-between"><span><span className="font-mono text-gold-300">{i.ticker}</span> <span className="text-slate-400">{i.name}</span></span><span className="font-mono">{i.trades}</span></li>)}
          </ul>
          <h2 className="mb-2 mt-5 font-display font-600">Sectors</h2>
          <div className="flex flex-wrap gap-1.5">{data.bySector?.map((x: any) => <span key={x.sector} className="chip">{x.sector} <span className="text-gold">{x.trades}</span></span>)}</div>
        </div>
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><span className="font-display font-600">Trade history ({trades.length})</span>
            <Select value={type} onChange={setType} opts={[["", "All types"], ["buy", "Buys"], ["sell", "Sells"], ["exchange", "Exchanges"]]} className="py-1.5" /></div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[560px]">
              <thead className="sticky top-0 border-b border-line bg-ink-700"><tr><th className="th">Issuer</th><th className="th">Type</th><th className="th text-right">Amount</th><th className="th">Owner</th><th className="th">Traded</th><th className="th">Published</th></tr></thead>
              <tbody className="divide-y divide-line">
                {trades.map((t: any) => (
                  <tr key={t.id} className="hover:bg-ink-700/40">
                    <td className="td"><span className="font-mono text-gold-300">{t.ticker ?? ""}</span> <span className="text-sm text-slate-300">{t.issuer}</span><div className="text-xs text-slate-500">{t.sector}</div></td>
                    <td className="td"><span className={pill(t.tx_type)}>{t.tx_type.toUpperCase()}</span></td>
                    <td className="td text-right font-mono">{money(t.amount_min, t.amount_max)}</td>
                    <td className="td text-sm capitalize text-slate-400">{t.owner ?? "—"}</td>
                    <td className="td text-sm text-slate-300">{t.tx_date ?? "—"}</td>
                    <td className="td text-sm text-slate-400">{ago(t.published_date)}{t.filed_after_days > 45 && <span className="ml-1 text-xs text-sell">late</span>}</td>
                  </tr>
                ))}
                {!trades.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={6}>No trades on record.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
