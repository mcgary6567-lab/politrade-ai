import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, ArrowLeftRight, Landmark, Building2, Sparkles, LogOut, Menu, X, ShieldCheck, UserCog, TrendingUp, Wallet, Sun, Moon, BriefcaseBusiness } from "lucide-react";
import { useAuth } from "../App";
import { useTheme } from "../lib/theme";
import { prefetch } from "../lib/api";
import { Search } from "lucide-react";
import Footer from "./Footer";
import { OfflineBar, InstallNudge } from "./InstallApp";
import Logo from "./Logo";

/** Warm the cache for a page when its nav link is hovered. */
const PREFETCH: Record<string, string[]> = { "/": ["/dashboard?assets=stocks"], "/trades": ["/trades?limit=50&offset=0", "/filters"], "/politicians": ["/politicians?"], "/issuers": ["/issuers?limit=60"], "/insights": ["/insights"], "/signals": ["/signals?days=90"], "/invest": ["/invest"], "/insiders": ["/insiders/summary?days=30", "/insiders?limit=50&offset=0"] };
const BASE_NAV: { to: string; label: string; icon: any; end?: boolean }[] = [
  { to: "/", label: "Home", icon: LayoutGrid, end: true },
  { to: "/trades", label: "Trades", icon: ArrowLeftRight },
  { to: "/politicians", label: "Politicians", icon: Landmark },
  { to: "/issuers", label: "Issuers", icon: Building2 },
  { to: "/insiders", label: "Insiders", icon: BriefcaseBusiness },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/signals", label: "Signals", icon: TrendingUp },
  { to: "/invest", label: "Invest Plan", icon: Wallet },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const signOut = () => { logout(); nav("/login"); };
  const NAV = [...BASE_NAV, { to: "/settings", label: "Settings", icon: UserCog }, ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : [])];

  return (
    <div className="flex min-h-screen flex-col bg-ink-900">
      <OfflineBar />
      <header className="sticky top-0 z-30 border-b border-line bg-ink-900/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5"><Logo className="h-11 w-11 shrink-0" /><span className="flex flex-col leading-none"><span className="whitespace-nowrap font-display text-xl font-700 tracking-tight">Hill<span className="text-gold">radar</span> <span className="text-base font-600 text-slate-400">AI</span></span><span className="mt-1 hidden whitespace-nowrap text-[10px] font-medium text-slate-500 lg:block">Congress trades, on your radar.</span></span></Link>
          <nav className="ml-1 hidden items-center gap-0 md:flex xl:ml-3 xl:gap-0.5">
            {BASE_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} title={n.label} onMouseEnter={() => PREFETCH[n.to]?.forEach(prefetch)} className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold transition lg:px-1.5 xl:px-2.5 xl:text-sm ${isActive ? "bg-gold/15 text-gold" : "text-slate-300 hover:bg-ink-700"}`}>
                <n.icon size={16} /> <span className="hidden lg:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <form className="relative ml-auto hidden 2xl:block" onSubmit={(e) => { e.preventDefault(); const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim(); if (q) nav(`/trades?q=${encodeURIComponent(q)}`); }}>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" />
            <input name="q" className="input w-40 py-1.5 pl-8 text-sm xl:w-52" placeholder="Politician or ticker…" />
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 2xl:ml-0 2xl:gap-2">
            {user?.role === "admin" && <Link to="/admin" className="btn-ghost hidden px-2.5 py-2 md:flex" title="Admin panel"><ShieldCheck size={16} /></Link>}
            <Link to="/settings" className="hidden max-w-[180px] items-center gap-2 truncate text-sm text-slate-400 hover:text-gold sm:flex" title="Your settings"><UserCog size={15} className="shrink-0" /><span className="hidden truncate xl:inline">{user?.name ?? user?.email}</span>
              <span className={`chip hidden py-0.5 text-[10px] xl:inline ${user?.pro ? "border-gold/50 text-gold" : ""}`}>{user?.role === "admin" ? "ADMIN" : user?.pro ? "PRO" : "FREE"}</span></Link>
            <button onClick={toggle} className="btn-ghost shrink-0 px-2.5 py-2" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle light / dark mode">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button onClick={signOut} className="btn-ghost shrink-0 gap-1.5 whitespace-nowrap px-3 py-2 text-sm" title="Logout"><LogOut size={15} /> <span className="hidden sm:inline">Logout</span></button>
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
      <InstallNudge />
    </div>
  );
}
