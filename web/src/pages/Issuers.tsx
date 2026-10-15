import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Search, ArrowLeft, Building2, Users, History, ExternalLink } from "lucide-react";
import { api, ago, money } from "../lib/api";
import { pill } from "./Home";
import { Select, KPI, partyTone, compact } from "../components/ui";

export default function Issuers() {
  const { id } = useParams();
  return id ? <Detail id={id} /> : <List />;
}

/** Company logo by ticker (proxied + disk-cached on our origin); falls back to a letter avatar. */
export function IssuerLogo({ ticker, name, size = 28, className = "" }: { ticker?: string | null; name?: string; size?: number; className?: string }) {
  const [err, setErr] = useState(false);
  const letter = String(ticker || name || "?").trim().charAt(0).toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (!ticker || err) return <span style={style} className={`grid shrink-0 place-items-center rounded-lg bg-ink-600 font-mono font-700 text-gold ${className}`}>{letter}</span>;
  return <img src={`/api/logo/${encodeURIComponent(ticker)}`} alt="" loading="lazy" onError={() => setErr(true)} style={style} className={`shrink-0 rounded-lg bg-white object-contain p-0.5 ${className}`} />;
}

function List() {
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const get = (k: string) => sp.get(k) ?? "";
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };
  const deps = ["q", "sector", "sort"].map(get).join("|");
  useEffect(() => { api("/filters").then(setFilters).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "60" }); for (const k of ["q", "sector", "sort"]) if (get(k)) p.set(k, get(k));
    const t = setTimeout(() => api<any>(`/issuers?${p}`).then((r) => { setRows(r.rows); setTotal(r.total); }).finally(() => setLoading(false)), 200);
    return () => clearTimeout(t);
  }, [deps]); // eslint-disable-line react-hooks/exhaustive-deps
  const more = async () => {
    const p = new URLSearchParams({ limit: "60", offset: String(rows.length) }); for (const k of ["q", "sector", "sort"]) if (get(k)) p.set(k, get(k));
    const r = await api<any>(`/issuers?${p}`); setRows([...rows, ...r.rows]);
  };

  return (
    <div className="space-y-5">
      <div><h1 className="flex items-center gap-2 font-display text-2xl font-700"><Building2 size={22} className="text-gold" /> Issuers</h1><p className="text-sm text-slate-400">{total.toLocaleString()} companies most traded by lawmakers</p></div>
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
          <input className="input pl-9" placeholder="Search company or ticker…" value={get("q")} onChange={(e) => set("q", e.target.value)} />
        </div>
        <Select value={get("sector")} onChange={(v) => set("sector", v)} opts={[["", "All sectors"], ...((filters?.sectors ?? []) as string[]).map((s) => [s, s] as [string, string])]} />
        <Select value={get("sort")} onChange={(v) => set("sort", v)} opts={[["", "Most trades"], ["volume", "Largest volume"], ["politicians", "Most politicians"], ["recent", "Most recent"], ["name", "Name A–Z"]]} />
      </div>
      <div className="card overflow-hidden">
        <ul className="divide-y divide-line md:hidden">
          {rows.map((i) => (
            <li key={i.id}>
              <Link to={`/issuers/${i.id}`} className="flex items-center gap-3 p-3.5 active:bg-ink-700/40">
                <IssuerLogo ticker={i.ticker} name={i.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-mono font-700 text-gold-300">{i.ticker ?? "—"}</span>{i.sector && <span className="chip py-0 text-[10px]">{i.sector}</span>}</div>
                  <div className="truncate text-sm font-semibold">{i.name}</div>
                  <div className="text-xs text-slate-500">{i.politicians ?? 0} politicians · last {ago(i.last_traded)}</div>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <div className="font-mono text-base text-slate-100">{i.trades}</div>
                  <div><span className="text-buy">{i.buys ?? 0} buy</span> · <span className="text-sell">{i.sells ?? 0} sell</span></div>
                  <div className="font-mono text-slate-400">{compact(i.volume)}</div>
                </div>
              </Link>
            </li>
          ))}
          {loading && !rows.length && <li className="p-8 text-center text-sm text-slate-500">Loading…</li>}
          {!loading && !rows.length && <li className="p-8 text-center text-sm text-slate-500">No issuers found.</li>}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-line"><tr>
              <th className="th">Ticker</th><th className="th">Company</th><th className="th">Sector</th>
              <th className="th text-right">Trades</th><th className="th text-right">Buys</th><th className="th text-right">Sells</th><th className="th text-right">Volume</th><th className="th text-right">Politicians</th><th className="th">Last</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((i) => (
                <tr key={i.id} className="hover:bg-ink-700/40">
                  <td className="td"><Link to={`/issuers/${i.id}`} className="flex items-center gap-2 font-mono font-semibold text-gold-300 hover:underline"><IssuerLogo ticker={i.ticker} name={i.name} size={24} />{i.ticker ?? "—"}</Link></td>
                  <td className="td font-semibold"><Link to={`/issuers/${i.id}`} className="hover:text-gold">{i.name}</Link></td>
                  <td className="td">{i.sector ? <button className="chip hover:border-gold/50" onClick={() => set("sector", i.sector)}>{i.sector}</button> : <span className="text-xs text-slate-500">—</span>}</td>
                  <td className="td text-right font-mono">{i.trades}</td>
                  <td className="td text-right font-mono text-buy">{i.buys ?? 0}</td>
                  <td className="td text-right font-mono text-sell">{i.sells ?? 0}</td>
                  <td className="td text-right font-mono text-slate-300">{compact(i.volume)}</td>
                  <td className="td text-right font-mono text-slate-300">{i.politicians ?? 0}</td>
                  <td className="td text-sm text-slate-400">{ago(i.last_traded)}</td>
                </tr>
              ))}
              {loading && !rows.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={9}>Loading…</td></tr>}
              {!loading && !rows.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={9}>No issuers found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length < total && <button className="btn-ghost w-full" onClick={more}>Show more ({(total - rows.length).toLocaleString()} left)</button>}
    </div>
  );
}

function Detail({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { setData(null); api(`/issuers/${id}`).then(setData).catch(() => setData({ error: true })); }, [id]);
  if (!data) return <p className="text-slate-500">Loading…</p>;
  if (data.error) return <p className="text-slate-500">Not found. <Link to="/issuers" className="text-gold">Back</Link></p>;
  const i = data.issuer, s = data.summary ?? {};
  return (
    <div className="space-y-5">
      <Link to="/issuers" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-gold"><ArrowLeft size={15} /> All issuers</Link>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <IssuerLogo ticker={i.ticker} name={i.name} size={64} className="!rounded-2xl" />
        <div className="flex-1"><h1 className="font-display text-2xl font-700">{i.name}</h1><p className="mt-1 text-slate-400">{i.sector ?? `${i.ticker ? "Ticker " + i.ticker : "Issuer"} · traded by ${s.politicians ?? 0} lawmakers`}</p></div>
        <Link to={`/trades?issuer=${i.id}`} className="btn-ghost text-sm"><ExternalLink size={14} /> Open in Trades</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Trades" value={s.trades ?? 0} />
        <KPI label="Buys / Sells" value={<><span className="text-buy">{s.buys ?? 0}</span> / <span className="text-sell">{s.sells ?? 0}</span></>} />
        <KPI label="Est. volume" value={compact(s.volume)} tone="text-gold" />
        <KPI label="Politicians" value={s.politicians ?? 0} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display font-600"><Users size={15} className="text-gold" /> Who trades it</h2>
          <ul className="space-y-2 text-sm">
            {data.topPols?.map((p: any) => <li key={p.id} className="flex items-center justify-between"><Link to={`/politicians/${p.id}`} className="hover:text-gold"><span className={`mr-1 ${partyTone(p.party)}`}>●</span>{p.name}</Link><span className="font-mono">{p.trades}</span></li>)}
          </ul>
        </div>
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 font-display font-600"><History size={15} className="text-gold" /> Trade history ({data.trades.length})</div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[560px]">
              <thead className="sticky top-0 border-b border-line bg-ink-700"><tr><th className="th">Politician</th><th className="th">Type</th><th className="th text-right">Amount</th><th className="th">Traded</th><th className="th">Published</th></tr></thead>
              <tbody className="divide-y divide-line">
                {data.trades.map((t: any) => (
                  <tr key={t.id} className="hover:bg-ink-700/40">
                    <td className="td"><Link to={`/politicians/${t.politician_id}`} className="font-semibold hover:text-gold">{t.politician}</Link><div className="text-xs text-slate-500">{[t.party, t.chamber, t.state].filter(Boolean).join(" · ")}</div></td>
                    <td className="td"><span className={pill(t.tx_type)}>{t.tx_type.toUpperCase()}</span></td>
                    <td className="td text-right font-mono">{money(t.amount_min, t.amount_max)}</td>
                    <td className="td text-sm text-slate-300">{t.tx_date ?? "—"}</td>
                    <td className="td text-sm text-slate-400">{ago(t.published_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
