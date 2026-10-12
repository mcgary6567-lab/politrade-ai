import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo";

type Brand = { name: string; version: string; contact: string; social: { x?: string; telegram?: string; github?: string } };

export default function Footer() {
  const [b, setB] = useState<Brand | null>(null);
  useEffect(() => { fetch("/api/branding").then((r) => r.json()).then(setB).catch(() => {}); }, []);
  const year = new Date().getFullYear();
  return (
    <footer className="mt-10 border-t border-line bg-ink-800">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-9 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-1">
          <div className="flex items-center gap-2"><Logo className="h-7 w-7" /><span className="font-display font-700">PoliTrade <span className="text-gold">AI</span></span></div>
          <p className="mt-3 max-w-xs text-sm text-slate-400">AI-powered tracker for publicly disclosed US congressional stock trades. For research only — not financial advice.</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><Link className="hover:text-gold" to="/trades">Trades</Link></li>
            <li><Link className="hover:text-gold" to="/politicians">Politicians</Link></li>
            <li><Link className="hover:text-gold" to="/issuers">Issuers</Link></li>
            <li><Link className="hover:text-gold" to="/insights">Insights</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Legal</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><a className="hover:text-gold" href="/terms">Terms &amp; Conditions</a></li>
            <li><a className="hover:text-gold" href="/disclaimer">Disclaimer</a></li>
            <li><a className="hover:text-gold" href="/privacy">Privacy Policy</a></li>
            <li><a className="hover:text-gold" href="/contact">Contact Us</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow</h4>
          <div className="mt-3 flex gap-2">
            <a className="btn-ghost px-3 py-2 text-sm" href={b?.social?.x || "#"} target="_blank" rel="noreferrer">X</a>
            <a className="btn-ghost px-3 py-2 text-sm" href={b?.social?.telegram || "#"} target="_blank" rel="noreferrer">Telegram</a>
            <a className="btn-ghost px-3 py-2 text-sm" href={b?.social?.github || "#"} target="_blank" rel="noreferrer">GitHub</a>
          </div>
          {b?.contact && <p className="mt-3 text-sm text-slate-400">{b.contact}</p>}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} PoliTrade AI. Data from public US congressional disclosures (STOCK Act).</span>
          <span>Not affiliated with any government body or lawmaker. v{b?.version ?? "1.0.0"}</span>
        </div>
      </div>
    </footer>
  );
}
