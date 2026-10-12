import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo";
import { Linkedin, FileText, ShieldCheck, AlertTriangle, Mail, ArrowLeftRight, Landmark, Building2, Sparkles, TrendingUp, Wallet } from "lucide-react";
import InstallApp from "./InstallApp";

type Brand = { name: string; version: string; contact: string; social: { x?: string; telegram?: string; github?: string; linkedin?: string } };
const XIcon = ({ size = 15 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.4 8.5L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.9-9L0 2h7l4.8 6.3L18.9 2zm-1.2 18h1.9L6.4 3.9H4.4L17.7 20z" /></svg>;

export default function Footer() {
  const [b, setB] = useState<Brand | null>(null);
  useEffect(() => { fetch("/api/branding").then((r) => r.json()).then(setB).catch(() => {}); }, []);
  const year = new Date().getFullYear();
  return (
    <footer className="mt-10 border-t border-line bg-ink-800">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-9 sm:grid-cols-2 md:grid-cols-5">
        <div className="sm:col-span-2 md:col-span-1">
          <div className="flex items-center gap-2"><Logo className="h-7 w-7" /><span className="font-display font-700">PoliTrade <span className="text-gold">AI</span></span></div>
          <p className="mt-3 max-w-xs text-sm text-slate-400">AI-powered tracker for publicly disclosed US congressional stock trades. For research only — not financial advice.</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><Link className="flex items-center gap-2 hover:text-gold" to="/trades"><ArrowLeftRight size={14} className="text-slate-500" /> Trades</Link></li>
            <li><Link className="flex items-center gap-2 hover:text-gold" to="/politicians"><Landmark size={14} className="text-slate-500" /> Politicians</Link></li>
            <li><Link className="flex items-center gap-2 hover:text-gold" to="/issuers"><Building2 size={14} className="text-slate-500" /> Issuers</Link></li>
            <li><Link className="flex items-center gap-2 hover:text-gold" to="/signals"><TrendingUp size={14} className="text-slate-500" /> AI Signals</Link></li>
            <li><Link className="flex items-center gap-2 hover:text-gold" to="/invest"><Wallet size={14} className="text-slate-500" /> Invest Plan</Link></li>
            <li><Link className="flex items-center gap-2 hover:text-gold" to="/insights"><Sparkles size={14} className="text-slate-500" /> Insights</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Legal</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><a className="flex items-center gap-2 hover:text-gold" href="/terms"><FileText size={14} className="text-slate-500" /> Terms &amp; Conditions</a></li>
            <li><a className="flex items-center gap-2 hover:text-gold" href="/disclaimer"><AlertTriangle size={14} className="text-slate-500" /> Disclaimer</a></li>
            <li><a className="flex items-center gap-2 hover:text-gold" href="/privacy"><ShieldCheck size={14} className="text-slate-500" /> Privacy Policy</a></li>
            <li><a className="flex items-center gap-2 hover:text-gold" href="/contact"><Mail size={14} className="text-slate-500" /> Contact Us</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {([["x", "X / Twitter", <XIcon />], ["linkedin", "LinkedIn", <Linkedin size={15} />]] as const).map(([k, label, icon]) => {
              const href = (b?.social as any)?.[k];
              return <a key={k} className={`btn-ghost gap-1.5 px-2.5 py-1.5 text-xs ${href ? "" : "opacity-40"}`} href={href || "#"} target={href ? "_blank" : undefined} rel="noreferrer" title={href ? label : `${label} — not set yet`} onClick={(e) => { if (!href) e.preventDefault(); }}>{icon}<span className="hidden sm:inline">{label}</span></a>;
            })}
          </div>
          {b?.contact && <p className="mt-3 text-sm text-slate-400">{b.contact}</p>}
        </div>
        <div id="install" className="sm:col-span-2 md:col-span-1"><InstallApp /></div>
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
