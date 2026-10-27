import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, BriefcaseBusiness, Landmark, Lock, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { api, ago } from "../lib/api";
import { useAuth } from "../App";
import { useProPrice } from "../lib/plan";
import { Select, KPI, compact, pill } from "../components/ui";
import IssuerLogo from "../components/IssuerLogo";

const VALUE_BANDS: [string, string][] = [["", "Any size"], ["100000", "$100K+"], ["1000000", "$1M+"], ["10000000", "$10M+"]];
const filingUrl = (r: any) => r.issuer_cik ? `https://www.sec.gov/Archives/edgar/data/${Number(r.issuer_cik)}/${String(r.accession).replace(/-/g, "")}/${r.accession}-index.htm` : null;
const shares = (n?: number | null) => n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const price = (n?: number | null) => n == null ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Corporate insiders: open-market buys and sells by officers, directors and 10% owners (SEC Form 4). */
export default function Insiders() {
  const { user } = useAuth();
  const proPrice = useProPrice();
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [locked, setLocked] = useState(0);
  const [sum, setSum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const get = (k: string) => sp.get(k) ?? "";
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };
  const KEYS = ["q", "type", "role", "min_value", "days", "congress", "sort"];
  const query = (offset = 0) => { const p = new URLSearchParams({ limit: "50", offset: String(offset) }); for (const k of KEYS) if (get(k)) p.set(k, get(k)); return p; };
  const deps = KEYS.map(get).join("|");

  useEffect(() => { api("/insiders/summary?days=30").then(setSum).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => api<any>(`/insiders?${query()}`).then((r) => { setRows(r.rows); setTotal(r.total); setLocked(r.locked ?? 0); }).finally(() => setLoading(false)), 200);
    return () => clearTimeout(t);
  }, [deps]); // eslint-disable-line react-hooks/exhaustive-deps
  const more = async () => { const r = await api<any>(`/insiders?${query(rows.length)}`); setRows([...rows, ...r.rows]); };
  const t = sum?.totals ?? {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-700"><BriefcaseBusiness size={22} className="text-gold" /> Corporate insiders</h1>
        <p className="text-sm text-slate-400">Open-market buys and sells by company officers, directors and 10% owners, from SEC Form 4 filings. Awards, option exercises and tax sales are left out.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Insider buys · 30d" value={<span className="text-buy">{compact(t.buy_value)}</span>} sub={`${t.buys ?? 0} purchases`} />
        <KPI label="Insider sells · 30d" value={<span className="text-sell">{compact(t.sell_value)}</span>} sub={`${t.sells ?? 0} sales`} />
        <KPI label="Companies · 30d" value={t.companies ?? 0} />
        <KPI label="Latest filing" value={<span className="text-lg">{t.last ? ago(t.last) : "—"}</span>} sub="SEC EDGAR, updated every 6 hours" />
      </div>

      {sum?.overlap?.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 font-display font-600"><Landmark size={15} className="text-gold" /> Congress + insiders, last 30 days</h2>
          <p className="mb-3 text-xs text-slate-500">Companies that lawmakers and the company's own insiders both traded.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sum.overlap.map((o: any) => (
              <Link key={o.ticker} to={o.issuer_id ? `/issuers/${o.issuer_id}` : `/insiders?q=${o.ticker}`} className="flex items-center gap-3 rounded-xl border border-line p-3 hover:border-gold/50">
                <IssuerLogo ticker={o.ticker} name={o.name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-700 text-gold-300">{o.ticker}</div>
                  <div className="text-xs text-slate-400">{o.pols} lawmaker{o.pols === 1 ? "" : "s"} (<span className="text-buy">{o.cbuys}B</span>/<span className="text-sell">{o.csells}S</span>) · {o.insiders} insider{o.insiders === 1 ? "" : "s"} (<span className="text-buy">{o.ins_buys}B</span>/<span className="text-sell">{o.ins_sells}S</span>)</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {sum && (sum.topBuys?.length > 0 || sum.topSells?.length > 0) && (
        <div className="grid gap-5 md:grid-cols-2">
          {([["Most bought by insiders", sum.topBuys, TrendingUp, "text-buy"], ["Most sold by insiders", sum.topSells, TrendingDown, "text-sell"]] as const).map(([title, list, Icon, tone]) => (
            <div key={title} className="card p-4">
              <h2 className="mb-3 flex items-center gap-2 font-display font-600"><Icon size={15} className={tone} /> {title} · 30d</h2>
              <ul className="space-y-2 text-sm">
                {(list ?? []).map((x: any) => (
                  <li key={x.ticker} className="flex items-center gap-2">
                    <IssuerLogo ticker={x.ticker} name={x.name} size={22} />
                    <button className="font-mono font-semibold text-gold-300 hover:underline" onClick={() => set("q", x.ticker)}>{x.ticker}</button>
                    <span className="truncate text-xs text-slate-400">{x.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-500">{x.insiders} insider{x.insiders === 1 ? "" : "s"}</span>
                    <span className={`w-16 shrink-0 text-right font-mono ${tone}`}>{compact(x.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
          <input className="input pl-9" placeholder="Insider, company or ticker…" value={get("q")} onChange={(e) => set("q", e.target.value)} />
        </div>
        <Select value={get("type")} onChange={(v) => set("type", v)} opts={[["", "Buys & sells"], ["buy", "Buys only"], ["sell", "Sells only"]]} />
        <Select value={get("role")} onChange={(v) => set("role", v)} opts={[["", "Any insider"], ["officer", "Officers"], ["director", "Directors"], ["owner", "10% owners"]]} />
        <Select value={get("min_value")} onChange={(v) => set("min_value", v)} opts={VALUE_BANDS} />
        <Select value={get("days")} onChange={(v) => set("days", v)} opts={[["", "Any time"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"]]} />
        <Select value={get("sort")} onChange={(v) => set("sort", v)} opts={[["", "Newest filings"], ["value", "Largest value"], ["traded", "Trade date"]]} />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={get("congress") === "1"} onChange={(e) => set("congress", e.target.checked ? "1" : "")} /> Also traded by Congress (90d)</label>
      </div>

      <div className="card overflow-hidden">
        <ul className="divide-y divide-line md:hidden">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3.5">
              <IssuerLogo ticker={r.ticker} name={r.issuer_name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className={pill(r.tx_type)}>{r.tx_type.toUpperCase()}</span><span className="font-mono font-700 text-gold-300">{r.ticker ?? "—"}</span>{r.congress_90d > 0 && <span className="chip py-0 text-[10px]" title="Lawmakers traded this stock in the last 90 days"><Landmark size={10} /> {r.congress_90d}</span>}</div>
                <div className="truncate text-sm font-semibold">{r.insider}</div>
                <div className="truncate text-xs text-slate-500">{r.role} · {r.issuer_name}</div>
              </div>
              <div className="shrink-0 text-right text-xs">
                <div className="font-mono text-base text-slate-100">{compact(r.value)}</div>
                <div className="text-slate-400">{shares(r.shares)} @ {price(r.price)}</div>
                <div className="text-slate-500">{ago(r.filed_date)}</div>
              </div>
            </li>
          ))}
          {loading && !rows.length && <li className="p-8 text-center text-sm text-slate-500">Loading…</li>}
          {!loading && !rows.length && <li className="p-8 text-center text-sm text-slate-500">No insider trades yet — the first SEC import runs in the background after deploy.</li>}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-line"><tr>
              <th className="th">Filed</th><th className="th">Company</th><th className="th">Insider</th><th className="th">Type</th>
              <th className="th text-right">Shares</th><th className="th text-right">Price</th><th className="th text-right">Value</th><th className="th">Traded</th><th className="th"></th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink-700/40">
                  <td className="td text-sm text-slate-400">{ago(r.filed_date)}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <IssuerLogo ticker={r.ticker} name={r.issuer_name} size={24} />
                      {r.issuer_id ? <Link to={`/issuers/${r.issuer_id}`} className="font-mono font-semibold text-gold-300 hover:underline">{r.ticker}</Link> : <span className="font-mono font-semibold text-gold-300">{r.ticker ?? "—"}</span>}
                      {r.congress_90d > 0 && <span className="chip py-0 text-[10px]" title={`${r.congress_90d} lawmaker(s) traded ${r.ticker} in the last 90 days`}><Landmark size={10} /> {r.congress_90d}</span>}
                    </div>
                    <div className="max-w-[220px] truncate text-xs text-slate-500">{r.issuer_name}</div>
                  </td>
                  <td className="td"><div className="font-semibold">{r.insider}</div><div className="max-w-[200px] truncate text-xs text-slate-500">{r.role}{r.plan_10b5_1 ? " · 10b5-1 plan" : ""}{r.direct ? "" : " · indirect"}</div></td>
                  <td className="td"><span className={pill(r.tx_type)}>{r.tx_type.toUpperCase()}</span></td>
                  <td className="td text-right font-mono">{shares(r.shares)}</td>
                  <td className="td text-right font-mono text-slate-300">{price(r.price)}</td>
                  <td className={`td text-right font-mono ${r.tx_type === "buy" ? "text-buy" : "text-sell"}`}>{compact(r.value)}</td>
                  <td className="td text-sm text-slate-300">{r.tx_date ?? "—"}</td>
                  <td className="td">{filingUrl(r) && <a href={filingUrl(r)!} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-gold" title="Open the SEC filing"><ExternalLink size={14} /></a>}</td>
                </tr>
              ))}
              {loading && !rows.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={9}>Loading…</td></tr>}
              {!loading && !rows.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={9}>No insider trades yet — the first SEC import runs in the background after deploy.</td></tr>}
            </tbody>
          </table>
        </div>
        {!user?.pro && locked > 0 && (
          <div className="flex flex-col items-center gap-2 border-t border-line p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold"><Lock size={18} /></div>
            <div className="text-sm font-700">{locked.toLocaleString()} more insider trade{locked === 1 ? "" : "s"} locked</div>
            <div className="max-w-sm text-xs text-slate-400">Upgrade to <b className="text-gold">Pro ({proPrice} / year)</b> for every insider and Congress trade, filters and alerts.</div>
          </div>
        )}
      </div>
      {user?.pro && rows.length < total && <button className="btn-ghost w-full" onClick={more}>Show more ({(total - rows.length).toLocaleString()} left)</button>}
      <p className="text-xs text-slate-500">Source: SEC EDGAR Form 4 filings (public). Values are shares × reported price. Not investment advice.</p>
    </div>
  );
}
