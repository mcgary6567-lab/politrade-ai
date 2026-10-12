import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api, ago } from "../lib/api";

export default function Issuers() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => api<any>(`/issuers${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) => setRows(r.rows)).finally(() => setLoading(false)), 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-700">Issuers</h1><p className="text-sm text-slate-400">Companies most traded by lawmakers</p></div>
      <div className="relative max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
        <input className="input pl-9" placeholder="Search company or ticker…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead className="border-b border-line"><tr>
              <th className="th">Ticker</th><th className="th">Company</th><th className="th">Sector</th>
              <th className="th text-right">Trades</th><th className="th text-right">Buys</th><th className="th text-right">Sells</th><th className="th">Last</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((i) => (
                <tr key={i.id} className="hover:bg-ink-700/40">
                  <td className="td font-mono font-semibold text-gold-300">{i.ticker ?? "—"}</td>
                  <td className="td font-semibold">
                    <Link to={`/trades?ticker=${encodeURIComponent(i.ticker ?? "")}`} className="hover:text-gold">{i.name}</Link>
                  </td>
                  <td className="td"><span className="chip">{i.sector ?? "Other"}</span></td>
                  <td className="td text-right font-mono">{i.trades}</td>
                  <td className="td text-right font-mono text-buy">{i.buys ?? 0}</td>
                  <td className="td text-right font-mono text-sell">{i.sells ?? 0}</td>
                  <td className="td text-sm text-slate-400">{ago(i.last_traded)}</td>
                </tr>
              ))}
              {loading && <tr><td className="td py-8 text-center text-slate-500" colSpan={7}>Loading…</td></tr>}
              {!loading && !rows.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={7}>No issuers found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
