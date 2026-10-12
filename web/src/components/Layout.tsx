import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, ArrowLeftRight, Landmark, Building2, Sparkles, LogOut, Menu, X, ShieldCheck, UserCog } from "lucide-react";
import { useAuth } from "../App";
import { prefetch } from "../lib/api";
import { Search } from "lucide-react";
import Footer from "./Footer";
import Logo from "./Logo";

/** Warm the cache for a page when its nav link is hovered. */
const PREFETCH: Record<string, string[]> = { "/": ["/dashboard?assets=stocks"], "/trades": ["/trades?limit=50&offset=0", "/filters"], "/politicians": ["/politicians?"], "/issuers": ["/issuers?limit=60"], "/insights": ["/insights"] };
const BASE_NAV: { to: string; label: string; icon: any; end?: boolean }[] = [
  { to: "/", label: "Home", icon: LayoutGrid, end: true },
  { to: "/trades", label: "Trades", icon: ArrowLeftRight },
  { to: "/politicians", label: "Politicians", icon: Landmark },
  { to: "/issuers", label: "Issuers", icon: Building2 },
  { to: "/insights", label: "Insights", icon: Sparkles },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const signOut = () => { logout(); nav("/login"); };
  const NAV = [...BASE_NAV, { to: "/settings", label: "Settings", icon: UserCog }, ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : [])];

  return (
    <div className="flex min-h-screen flex-col bg-ink-900">
      <header className="sticky top-0 z-30 border-b border-line bg-ink-900/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5"><Logo className="h-8 w-8" /><span className="whitespace-nowrap font-display text-lg font-700 tracking-tight">Poli<span className="text-gold">Trade</span> <span className="text-slate-400">AI</span></span></Link>
          <nav className="ml-4 hidden items-center gap-0.5 md:flex">
            {NAV.filter((n) => n.to !== "/settings").map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onMouseEnter={() => PREFETCH[n.to]?.forEach(prefetch)} className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition lg:px-3 ${isActive ? "bg-gold/15 text-gold" : "text-slate-300 hover:bg-ink-700"}`}>
                <n.icon size={16} /> {n.label}
              </NavLink>
            ))}
          </nav>
          <form className="relative ml-auto hidden lg:block" onSubmit={(e) => { e.preventDefault(); const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim(); if (q) nav(`/trades?q=${encodeURIComponent(q)}`); }}>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" />
            <input name="q" className="input w-40 py-1.5 pl-8 text-sm xl:w-52" placeholder="Politician or ticker…" />
          </form>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Link to="/settings" className="hidden max-w-[180px] items-center gap-2 truncate text-sm text-slate-400 hover:text-gold sm:flex" title="Your settings"><UserCog size={15} className="shrink-0" /><span className="truncate">{user?.name ?? user?.email}</span>
              <span className={`chip py-0.5 text-[10px] ${user?.pro ? "border-gold/50 text-gold" : ""}`}>{user?.role === "admin" ? "ADMIN" : user?.pro ? "PRO" : "FREE"}</span></Link>
            <button onClick={signOut} className="btn-ghost px-3 py-2 text-sm" title="Sign out"><LogOut size={15} /></button>
            <button onClick={() => setOpen(!open)} className="btn-ghost px-2.5 py-2 md:hidden" aria-label="Menu">{open ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
        {open && (
          <nav className="grid gap-1 border-t border-line px-4 py-3 md:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2.5 font-semibold ${isActive ? "bg-gold/15 text-gold" : "text-slate-200 hover:bg-ink-700"}`}>
                <n.icon size={17} /> {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
