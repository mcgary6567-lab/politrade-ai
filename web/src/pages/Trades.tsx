import { useEffect, useState } from "react";
import { useAuth } from "../App";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Sparkles, Download, SlidersHorizontal, X } from "lucide-react";
import { api, money, ago, getToken } from "../lib/api";
import { pill } from "./Home";
import { Select, AMOUNT_BANDS } from "../components/ui";

const KEYS = ["q", "type", "party", "chamber", "state", "sector", "owner", "ticker", "politician", "issuer", "from", "to", "pub_from", "pub_to", "days", "amount_min", "amount_max", "sort"] as const;

export default function Trades() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [branding, setBranding] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<any>(null);
  const [more, setMore] = useState(false);
  const get = (k: string) => sp.get(k) ?? "";
  const offset = Number(sp.get("offset") ?? 0);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== "offset") n.delete("offset"); setSp(n); };
  const setMany = (kv: Record<string, string>) => { const n = new URLSearchParams(sp); for (const [k, v] of Object.entries(kv)) v ? n.set(k, v) : n.delete(k); n.delete("offset"); setSp(n); };
  const clear = () => setSp(new URLSearchParams());

  const query = () => { const p = new URLSearchParams(); for (const k of KEYS) if (get(k)) p.set(k, get(k)); return p; };
  const active = KEYS.filter((k) => k !== "sort" && get(k));
  const deps = KEYS.map(get).join("|");

  const [pols, setPols] = useState<any[]>([]);
  useEffect(() => { api("/filters").then(setFilters).catch(() => {}); api<any>("/politicians?sort=name").then((r) => setPols(r.rows)).catch(() => {}); }, []);
  const polName = pols.find((p) => String(p.id) === get("politician"))?.name;
  useEffect(() => {
    setLoading(true);
    const p = query(); p.set("limit", "50"); p.set("offset", String(offset));
    api<any>(`/trades?${p}`).then((r) => { setRows(r.rows); setTotal(r.total); }).finally(() => setLoading(false));
  }, [deps, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!user?.pro) fetch("/api/branding").then((r) => r.json()).then(setBranding).catch(() => {}); }, [user?.pro]);
  const exportCsv = async () => {
    if (!user?.pro) return;
    const res = await fetch(`/api/trades.csv?${query()}`, { headers: { authorization: `Bearer ${getToken()}` } });
    const blob = await res.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "trades.csv"; a.click();
  };
  const band = AMOUNT_BANDS.find((b) => b[0] === get("amount_min") && b[1] === get("amount_max"))?.[2] ?? "";
  const opt = (arr?: string[], all = "All") => [["", all], ...(arr ?? []).map((v) => [v, v])] as [string, string][];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-2xl font-700">Trades</h1><p className="text-sm text-slate-400">{total.toLocaleString()} disclosed transactions{active.length ? ` · ${active.length} filter${active.length > 1 ? "s" : ""} on` : ""}</p></div>
        <div className="flex gap-2">
          <button className="btn-ghost px-3 py-2 text-sm" onClick={() => setMore(!more)}><SlidersHorizontal size={15} /> {more ? "Less filters" : "More filters"}</button>
          <button className="btn-ghost px-3 py-2 text-sm disabled:opacity-50" disabled={!user?.pro} onClick={exportCsv} title={user?.pro ? "Download CSV of current filter" : "CSV export is a Pro feature"}><Download size={15} /> CSV{!user?.pro && <span className="text-[10px] text-gold">PRO</span>}</button>
        </div>
      </div>

      {!user?.pro && (
        <div className="card flex flex-wrap items-center gap-3 border-gold/40 bg-gold/5 p-4 text-sm">
          <div className="flex-1 basis-[260px]"><b className="text-gold">Free plan:</b> <span className="text-slate-300">you are seeing the last 30 days of filings. <b>Pro ($300 / year)</b> unlocks the full history since 2014, instant Telegram / WhatsApp / Email alerts, unlimited watchlist and CSV export.</span></div>
          <a href={`mailto:${branding?.contact ?? "hello@politrade.ai"}?subject=Upgrade to Pro`} className="btn-gold px-3 py-2 text-xs">Upgrade to Pro</a>
        </div>
      )}
      <div className="card space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
            <input className="input pl-9" placeholder="Search politician, company or ticker…" defaultValue={get("q")} key={get("q")} onKeyDown={(e) => e.key === "Enter" && set("q", (e.target as HTMLInputElement).value)} />
          </div>
          <Select value={get("type")} onChange={(v) => set("type", v)} opts={[["", "All types"], ["buy", "Buys"], ["sell", "Sells"], ["exchange", "Exchanges"]]} />
          <Select value={get("party")} onChange={(v) => set("party", v)} opts={opt(filters?.parties, "All parties")} />
          <Select value={get("chamber")} onChange={(v) => set("chamber", v)} opts={opt(filters?.chambers, "Both chambers")} />
          <Select value={get("days")} onChange={(v) => set("days", v)} opts={[["", "All time"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last year"]]} />
          <Select value={get("sort") || "published"} onChange={(v) => set("sort", v === "published" ? "" : v)} opts={[["published", "Newest filed"], ["traded", "Newest traded"], ["amount", "Largest amount"], ["amount_asc", "Smallest amount"], ["delay", "Slowest filers"], ["published_asc", "Oldest filed"]]} />
        </div>
        {more && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
            <Select value={get("politician")} onChange={(v) => set("politician", v)} className="max-w-[220px]" opts={[["", "All politicians"], ...pols.map((p) => [String(p.id), p.name] as [string, string])]} />
            <input className="input w-28 font-mono uppercase" list="tickers" placeholder="Ticker" defaultValue={get("ticker")} key={"t" + get("ticker")} onKeyDown={(e) => e.key === "Enter" && set("ticker", (e.target as HTMLInputElement).value)} onBlur={(e) => e.target.value !== get("ticker") && set("ticker", e.target.value)} />
            <datalist id="tickers">{(filters?.tickers ?? []).map((t: string) => <option key={t} value={t} />)}</datalist>
            <Select value={get("sector")} onChange={(v) => set("sector", v)} opts={opt(filters?.sectors, "All sectors")} />
            <Select value={get("state")} onChange={(v) => set("state", v)} opts={opt(filters?.states, "All states")} />
            <Select value={get("owner")} onChange={(v) => set("owner", v)} opts={opt(filters?.owners, "Any owner")} />
            <Select value={band} onChange={(v) => { const b = AMOUNT_BANDS.find((x) => x[2] === v)!; setMany({ amount_min: b[0], amount_max: b[1] }); }} opts={AMOUNT_BANDS.map((b) => [b[2], b[2]] as [string, string]).map(([v, l]) => [v === "Any amount" ? "" : v, l])} />
            <label className="flex items-center gap-1.5 text-sm text-slate-400">Traded <input type="date" className="input w-auto py-2" value={get("from")} onChange={(e) => set("from", e.target.value)} /> → <input type="date" className="input w-auto py-2" value={get("to")} onChange={(e) => set("to", e.target.value)} /></label>
            <label className="flex items-center gap-1.5 text-sm text-slate-400">Filed <input type="date" className="input w-auto py-2" value={get("pub_from")} onChange={(e) => set("pub_from", e.target.value)} /> → <input type="date" className="input w-auto py-2" value={get("pub_to")} onChange={(e) => set("pub_to", e.target.value)} /></label>
          </div>
        )}
        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
            {active.filter((k) => k !== "amount_max").map((k) => (
              <button key={k} className="chip hover:border-sell/50 hover:text-sell" onClick={() => k === "amount_min" ? setMany({ amount_min: "", amount_max: "" }) : set(k, "")}>
                {k === "amount_min" ? `amount: ${band || "custom"}` : k === "politician" ? `politician: ${polName ?? get(k)}` : `${k.replace("pub_", "filed ")}: ${get(k)}`} <X size={12} />
              </button>
            ))}
            <button className="ml-auto text-xs font-semibold text-slate-400 hover:text-gold" onClick={clear}>Clear all</button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-line"><tr>
              <th className="th">Politician</th><th className="th">Issuer</th><th className="th">Type</th>
              <th className="th text-right">Amount</th><th className="th">Owner</th><th className="th">Traded</th><th className="th">Published</th><th className="th text-right">Delay</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink-700/40">
                  <td className="td"><Link to={`/politicians/${r.politician_id}`} className="font-semibold hover:text-gold">{r.politician}</Link>
                    <div className="text-xs text-slate-500">{[r.party, r.chamber, r.state].filter(Boolean).join(" · ")}</div></td>
                  <td className="td"><div className="font-semibold">{r.ticker ? <Link to={`/issuers/${r.issuer_id}`} className="font-mono text-gold-300 hover:underline">{r.ticker}</Link> : "—"} <span className="chip ml-1 py-0 text-[10px]">{r.sector ?? "Other"}</span></div>
                    <div className="max-w-[220px] truncate text-xs text-slate-400">{r.issuer}</div></td>
                  <td className="td"><span className={pill(r.tx_type)}>{r.tx_type.toUpperCase()}</span></td>
                  <td className="td text-right font-mono">{money(r.amount_min, r.amount_max)}</td>
                  <td className="td text-sm capitalize text-slate-400">{r.owner ?? "—"}</td>
                  <td className="td text-sm text-slate-300">{r.tx_date ?? "—"}</td>
                  <td className="td text-sm text-slate-400">{ago(r.published_date)}
                    {r.ai_note && <div className="mt-0.5 flex max-w-[260px] items-start gap-1 text-xs text-slate-500"><Sparkles size={11} className="mt-0.5 shrink-0 text-gold" />{r.ai_note}</div>}</td>
                  <td className={`td text-right font-mono text-sm ${r.filed_after_days > 45 ? "text-sell" : "text-slate-400"}`}>{r.filed_after_days != null ? `${r.filed_after_days}d` : "—"}</td>
                </tr>
              ))}
              {loading && <tr><td className="td py-8 text-center text-slate-500" colSpan={8}>Loading…</td></tr>}
              {!loading && !rows.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={8}>No trades match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button className="btn-ghost text-sm disabled:opacity-40" disabled={offset <= 0} onClick={() => set("offset", String(Math.max(0, offset - 50)))}>← Previous</button>
        <span className="text-sm text-slate-500">{total ? offset + 1 : 0}–{Math.min(offset + 50, total)} of {total.toLocaleString()}</span>
        <button className="btn-ghost text-sm disabled:opacity-40" disabled={offset + 50 >= total} onClick={() => set("offset", String(offset + 50))}>Next →</button>
      </div>
      <p className="text-xs text-slate-500">Delay = days between the trade and its public filing (STOCK Act requires ≤45 days). Red marks late filings.</p>
    </div>
  );
}
