import { useEffect, useState } from "react";
import { useAuth } from "../App";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Sparkles, Download, SlidersHorizontal, X, ArrowLeftRight, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { api, money, ago, getToken } from "../lib/api";
import { Select, AMOUNT_BANDS, pill } from "../components/ui";
import IssuerLogo from "../components/IssuerLogo";
import { useProPrice } from "../lib/plan";

const KEYS = ["q", "type", "party", "chamber", "state", "sector", "owner", "ticker", "politician", "issuer", "from", "to", "pub_from", "pub_to", "days", "amount_min", "amount_max", "sort"] as const;

/** Realistic-looking filler rows shown blurred behind the Pro lock — fake data, so nothing real is exposed, but it
 *  reads like a populated feed so visitors can see there is more to unlock. */
const LOCK_SAMPLES = [
  { politician: "Sen. Patricia Coleman", party: "Democrat", chamber: "Senate", state: "NY", ticker: "GOOGL", issuer: "Alphabet Inc.", tx_type: "buy", amount_min: 15001, amount_max: 50000, tx_date: "2026-09-12", published_date: "2026-09-24", filed_after_days: 12, owner: "Spouse" },
  { politician: "Rep. Michael Hayes", party: "Republican", chamber: "House", state: "TX", ticker: "META", issuer: "Meta Platforms Inc.", tx_type: "sell", amount_min: 50001, amount_max: 100000, tx_date: "2026-09-05", published_date: "2026-09-19", filed_after_days: 14, owner: "Self" },
  { politician: "Sen. Robert Jennings", party: "Republican", chamber: "Senate", state: "FL", ticker: "AVGO", issuer: "Broadcom Inc.", tx_type: "buy", amount_min: 100001, amount_max: 250000, tx_date: "2026-08-29", published_date: "2026-09-16", filed_after_days: 18, owner: "Joint" },
  { politician: "Rep. Angela Brooks", party: "Democrat", chamber: "House", state: "CA", ticker: "XOM", issuer: "Exxon Mobil Corp.", tx_type: "sell", amount_min: 1001, amount_max: 15000, tx_date: "2026-09-01", published_date: "2026-09-21", filed_after_days: 20, owner: "Self" },
  { politician: "Sen. David Whitmore", party: "Republican", chamber: "Senate", state: "OH", ticker: "LLY", issuer: "Eli Lilly and Company", tx_type: "buy", amount_min: 250001, amount_max: 500000, tx_date: "2026-08-22", published_date: "2026-09-10", filed_after_days: 19, owner: "Self" },
  { politician: "Rep. Karen Mitchell", party: "Democrat", chamber: "House", state: "WA", ticker: "JPM", issuer: "JPMorgan Chase & Co.", tx_type: "buy", amount_min: 15001, amount_max: 50000, tx_date: "2026-09-03", published_date: "2026-09-18", filed_after_days: 15, owner: "Spouse" },
] as const;
const lockSample = (i: number) => LOCK_SAMPLES[i % LOCK_SAMPLES.length];

export default function Trades() {
  const { user } = useAuth();
  const price = useProPrice();
  const [sp, setSp] = useSearchParams();
  const [branding, setBranding] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [locked, setLocked] = useState(0); // Free plan: how many trades are hidden behind Pro
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
  useEffect(() => { api("/filters").then(setFilters).catch(() => {}); }, []);
  useEffect(() => { if (more || get("politician")) api<any>("/politicians?sort=name").then((r) => setPols(r.rows)).catch(() => {}); }, [more]); // eslint-disable-line react-hooks/exhaustive-deps
  const polName = pols.find((p) => String(p.id) === get("politician"))?.name;
  useEffect(() => {
    setLoading(true);
    const p = query(); p.set("limit", "50"); p.set("offset", String(offset));
    api<any>(`/trades?${p}`).then((r) => { setRows(r.rows); setTotal(r.total); setLocked(r.locked ?? 0); }).finally(() => setLoading(false));
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
        <div><h1 className="flex items-center gap-2 font-display text-2xl font-700"><ArrowLeftRight size={22} className="text-gold" /> Trades</h1><p className="text-sm text-slate-400">{total.toLocaleString()} disclosed transactions{active.length ? ` · ${active.length} filter${active.length > 1 ? "s" : ""} on` : ""}</p></div>
        <div className="flex gap-2">
          <button className="btn-ghost px-3 py-2 text-sm" onClick={() => setMore(!more)}><SlidersHorizontal size={15} /> {more ? "Less filters" : "More filters"}</button>
          <button className="btn-ghost px-3 py-2 text-sm disabled:opacity-50" disabled={!user?.pro} onClick={exportCsv} title={user?.pro ? "Download CSV of current filter" : "CSV export is a Pro feature"}><Download size={15} /> CSV{!user?.pro && <span className="text-[10px] text-gold">PRO</span>}</button>
        </div>
      </div>

      {!user?.pro && (
        <div className="card flex flex-wrap items-center gap-3 border-gold/40 bg-gold/5 p-4 text-sm">
          <div className="flex-1 basis-[260px]"><b className="text-gold">Free plan:</b> <span className="text-slate-300">you are seeing a preview of {rows.length} trade{rows.length === 1 ? "" : "s"}{total > rows.length ? ` out of ${total.toLocaleString()}` : ""}. <b>Pro ({price} / year)</b> unlocks every trade, the full history since 2014, AI Scanning, the Investment Plan, instant Telegram / WhatsApp / Email alerts, unlimited watchlist and CSV export.</span></div>
          <a href={`mailto:${branding?.contact ?? "info@hillradar.com"}?subject=Upgrade to Pro`} className="btn-gold px-3 py-2 text-xs">Upgrade to Pro</a>
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
        {/* phone: one card per trade */}
        <ul className="divide-y divide-line md:hidden">
          {rows.map((r) => (
            <li key={r.id} className="p-3.5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={pill(r.tx_type)}>{r.tx_type.toUpperCase()}</span>
                    <IssuerLogo ticker={r.ticker} name={r.issuer} size={20} />
                    {r.ticker ? <Link to={`/issuers/${r.issuer_id}`} className="font-mono text-base font-700 text-gold-300">{r.ticker}</Link> : <span className="text-slate-500">—</span>}
                    <span className="truncate text-xs text-slate-400">{r.issuer}</span>
                  </div>
                  <Link to={`/politicians/${r.politician_id}`} className="mt-1.5 block truncate text-sm font-semibold">{r.politician}</Link>
                  <div className="text-xs text-slate-500">{[r.party, r.chamber, r.state].filter(Boolean).join(" · ")}{r.owner ? ` · ${r.owner}` : ""}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm text-slate-100">{money(r.amount_min, r.amount_max)}</div>
                  <div className="mt-1 text-xs text-slate-400">{r.tx_date ?? "—"}</div>
                  <div className={`text-[11px] ${r.filed_after_days > 45 ? "text-sell" : "text-slate-500"}`}>filed {ago(r.published_date)}{r.filed_after_days != null ? ` · ${r.filed_after_days}d` : ""}</div>
                </div>
              </div>
              {r.ai_note && <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-ink-800/70 px-2.5 py-1.5 text-xs text-slate-400"><Sparkles size={11} className="mt-0.5 shrink-0 text-gold" />{r.ai_note}</div>}
            </li>
          ))}
          {!user?.pro && locked > 0 && rows.length > 0 && (
            <li className="relative">
              <ul aria-hidden className="divide-y divide-line pointer-events-none select-none blur-[6px]">
                {Array.from({ length: Math.min(locked, 5) }, (_, i) => lockSample(i)).map((s, i) => (
                  <li key={i} className="p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className={pill(s.tx_type)}>{s.tx_type.toUpperCase()}</span><IssuerLogo ticker={s.ticker} name={s.issuer} size={20} /><span className="font-mono text-base font-700 text-gold-300">{s.ticker}</span><span className="truncate text-xs text-slate-400">{s.issuer}</span></div>
                        <span className="mt-1.5 block truncate text-sm font-semibold">{s.politician}</span>
                        <div className="text-xs text-slate-500">{[s.party, s.chamber, s.state].join(" · ")} · {s.owner}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-sm text-slate-100">{money(s.amount_min, s.amount_max)}</div>
                        <div className="mt-1 text-xs text-slate-400">{s.tx_date}</div>
                        <div className="text-[11px] text-slate-500">filed · {s.filed_after_days}d</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <LockCTA locked={locked} contact={branding?.contact} overlay />
            </li>
          )}
          {loading && !rows.length && Array.from({ length: 6 }, (_, i) => <li key={i} className="p-3.5"><div className="h-12 animate-pulse rounded bg-ink-600/60" /></li>)}
          {!loading && !rows.length && <li className="p-8 text-center text-sm text-slate-500">No trades match these filters.</li>}
        </ul>
        <div className="hidden overflow-x-auto md:block">
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
                  <td className="td"><div className="flex items-center gap-2"><IssuerLogo ticker={r.ticker} name={r.issuer} size={26} /><div className="min-w-0"><div className="font-semibold">{r.ticker ? <Link to={`/issuers/${r.issuer_id}`} className="font-mono text-gold-300 hover:underline">{r.ticker}</Link> : "—"} {r.sector && <span className="chip ml-1 py-0 text-[10px]">{r.sector}</span>}</div>
                    <div className="max-w-[220px] truncate text-xs text-slate-400">{r.issuer}</div></div></div></td>
                  <td className="td"><span className={pill(r.tx_type)}>{r.tx_type.toUpperCase()}</span></td>
                  <td className="td text-right font-mono">{money(r.amount_min, r.amount_max)}</td>
                  <td className="td text-sm capitalize text-slate-400">{r.owner ?? "—"}</td>
                  <td className="td text-sm text-slate-300">{r.tx_date ?? "—"}</td>
                  <td className="td text-sm text-slate-400">{ago(r.published_date)}
                    {r.ai_note && <div className="mt-0.5 flex max-w-[260px] items-start gap-1 text-xs text-slate-500"><Sparkles size={11} className="mt-0.5 shrink-0 text-gold" />{r.ai_note}</div>}</td>
                  <td className={`td text-right font-mono text-sm ${r.filed_after_days > 45 ? "text-sell" : "text-slate-400"}`}>{r.filed_after_days != null ? `${r.filed_after_days}d` : "—"}</td>
                </tr>
              ))}
              {!user?.pro && locked > 0 && rows.length > 0 && (<>
                {Array.from({ length: Math.min(locked, 5) }, (_, i) => lockSample(i)).map((s, i) => (
                  <tr key={`lk${i}`} aria-hidden className="pointer-events-none select-none blur-[6px]">
                    <td className="td"><span className="font-semibold">{s.politician}</span><div className="text-xs text-slate-500">{[s.party, s.chamber, s.state].join(" · ")}</div></td>
                    <td className="td"><div className="flex items-center gap-2"><IssuerLogo ticker={s.ticker} name={s.issuer} size={26} /><div className="min-w-0"><div className="font-semibold"><span className="font-mono text-gold-300">{s.ticker}</span></div><div className="max-w-[220px] truncate text-xs text-slate-400">{s.issuer}</div></div></div></td>
                    <td className="td"><span className={pill(s.tx_type)}>{s.tx_type.toUpperCase()}</span></td>
                    <td className="td text-right font-mono">{money(s.amount_min, s.amount_max)}</td>
                    <td className="td text-sm capitalize text-slate-400">{s.owner}</td>
                    <td className="td text-sm text-slate-300">{s.tx_date}</td>
                    <td className="td text-sm text-slate-400">filed · {s.filed_after_days}d</td>
                    <td className="td text-right font-mono text-sm text-slate-400">{s.filed_after_days}d</td>
                  </tr>
                ))}
                <tr><td colSpan={8} className="p-0"><LockCTA locked={locked} contact={branding?.contact} /></td></tr>
              </>)}
              {loading && !rows.length && Array.from({ length: 8 }, (_, i) => <tr key={i}><td className="td" colSpan={8}><div className="h-8 animate-pulse rounded bg-ink-600/60" /></td></tr>)}
              {!loading && !rows.length && <tr><td className="td py-8 text-center text-slate-500" colSpan={8}>No trades match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {user?.pro && (
        <div className="flex items-center justify-between">
          <button className="btn-ghost text-sm disabled:opacity-40" disabled={offset <= 0} onClick={() => set("offset", String(Math.max(0, offset - 50)))}><ChevronLeft size={15} /> Previous</button>
          <span className="text-sm text-slate-500">{total ? offset + 1 : 0}–{Math.min(offset + 50, total)} of {total.toLocaleString()}</span>
          <button className="btn-ghost text-sm disabled:opacity-40" disabled={offset + 50 >= total} onClick={() => set("offset", String(offset + 50))}>Next <ChevronRight size={15} /></button>
        </div>
      )}
      <p className="text-xs text-slate-500">Delay = days between the trade and its public filing (STOCK Act requires ≤45 days). Red marks late filings.</p>
    </div>
  );
}

/** Pro upsell shown over (overlay) or under the blurred, locked trades on the Free plan. */
function LockCTA({ locked, contact, overlay }: { locked: number; contact?: string; overlay?: boolean }) {
  const price = useProPrice();
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-4 py-6 text-center ${overlay ? "absolute inset-0 z-10 bg-gradient-to-t from-ink-900 via-ink-900/90 to-transparent" : "border-t border-line"}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold"><Lock size={18} /></div>
      <div className="text-sm font-700">{locked.toLocaleString()} more trade{locked === 1 ? "" : "s"} locked</div>
      <div className="max-w-sm text-xs text-slate-400">Upgrade to <b className="text-gold">Pro ({price} / year)</b> to unlock every trade, the full history since 2014, AI Scanning, alerts and CSV export.</div>
      <a href={`mailto:${contact ?? "info@hillradar.com"}?subject=Upgrade to Pro`} className="btn-gold mt-1 px-4 py-2 text-xs">Unlock all trades with Pro</a>
    </div>
  );
}
