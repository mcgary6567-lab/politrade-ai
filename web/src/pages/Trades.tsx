import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { api, money, ago } from "../lib/api";
import { pill } from "./Home";

export default function Trades() {
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const q = sp.get("q") ?? "", type = sp.get("type") ?? "", party = sp.get("party") ?? "", chamber = sp.get("chamber") ?? "";
  const offset = Number(sp.get("offset") ?? 0);

  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== "offset") n.delete("offset"); setSp(n); };

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "50", offset: String(offset) });
    for (const [k, v] of [["q", q], ["type", type], ["party", party], ["chamber", chamber]]) if (v) p.set(k, v);
    api<any>(`/trades?${p}`).then((r) => { setRows(r.rows); setTotal(r.total); }).finally(() => setLoading(false));
  }, [q, type, party, chamber, offset]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-2xl font-700">Trades</h1><p className="text-sm text-slate-400">{total.toLocaleString()} disclosed transactions</p></div>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
          <input className="input pl-9" placeholder="Search politician, company or ticker…" defaultValue={q} onKeyDown={(e) => e.key === "Enter" && set("q", (e.target as HTMLInputElement).value)} />
        </div>
        <Select value={type} onChange={(v) => set("type", v)} opts={[["", "All types"], ["buy", "Buys"], ["sell", "Sells"], ["exchange", "Exchanges"]]} />
        <Select value={party} onChange={(v) => set("party", v)} opts={[["", "All parties"], ["Democrat", "Democrat"], ["Republican", "Republican"], ["Independent", "Independent"]]} />
        <Select value={chamber} onChange={(v) => set("chamber", v)} opts={[["", "Both chambers"], ["House", "House"], ["Senate", "Senate"]]} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-line"><tr>
              <th className="th">Politician</th><th className="th">Issuer</th><th className="th">Type</th>
              <th className="th text-right">Amount</th><th className="th">Traded</th><th className="th">Published</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink-700/40">
                  <td className="td"><Link to={`/politicians/${r.politician_id}`} className="font-semibold hover:text-gold">{r.politician}</Link>
                    <div className="text-xs text-slate-500">{[r.party, r.chamber, r.state].filter(Boolean).join(" · ")}</div></td>
                  <td className="td"><div className="font-semibold">{r.ticker ? <span className="font-mono text-gold-300">{r.ticker}</span> : "—"}</div>
                    <div className="truncate text-xs text-slate-400">{r.issuer}</div></td>
                  <td className="td"><span className={pill(r.tx_type)}>{r.tx_type.toUpperCase()}</span></td>
                  <td className="td text-right font-mono">{money(r.amount_min, r.amount_max)}</td>
                  <td className="td text-sm text-slate-300">{r.tx_date ?? "—"}</td>
                  <td className="td text-sm text-slate-400">{ago(r.published_date)}
                    {r.ai_note && <div className="mt-0.5 flex items-start gap-1 text-xs text-slate-500"><Sparkles size={11} className="mt-0.5 shrink-0 text-gold" />{r.ai_note}</div>}</td>
                </tr>
              ))}
              {loading && <tr><td className="td py-8 text-center text-slate-500" colSpan={6}>Loading…</td></tr>}
              {!loading && !rows.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={6}>No trades match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button className="btn-ghost text-sm disabled:opacity-40" disabled={offset <= 0} onClick={() => set("offset", String(Math.max(0, offset - 50)))}>← Previous</button>
        <span className="text-sm text-slate-500">{offset + 1}–{Math.min(offset + 50, total)} of {total.toLocaleString()}</span>
        <button className="btn-ghost text-sm disabled:opacity-40" disabled={offset + 50 >= total} onClick={() => set("offset", String(offset + 50))}>Next →</button>
      </div>
    </div>
  );
}

function Select({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <select className="input w-auto cursor-pointer" value={value} onChange={(e) => onChange(e.target.value)}>
      {opts.map(([v, l]) => <option key={v} value={v} className="bg-ink-800">{l}</option>)}
    </select>
  );
}
