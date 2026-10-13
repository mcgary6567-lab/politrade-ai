import { LogIn, KeyRound, Lock, UserPlus, Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../App";
import Logo from "../components/Logo";

/** Sign in with email + password, or email + 4-digit PIN (set in Settings). */
export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"password" | "pin">(() => { try { return (localStorage.getItem("pt_login_mode") as any) || "password"; } catch { return "password"; } });
  const [email, setEmail] = useState(() => { try { return localStorage.getItem("pt_last_email") ?? ""; } catch { return ""; } });
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<{ signup: boolean } | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch("/api/auth/options").then((r) => r.json()).then(setOpts).catch(() => setOpts({ signup: true })); }, []);
  useEffect(() => { if (mode === "pin") pinRef.current?.focus(); try { localStorage.setItem("pt_login_mode", mode); } catch { /* ignore */ } }, [mode]);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await api<{ token: string }>("/auth/login", { body: mode === "pin" ? { email, pin } : { email, password } });
      try { localStorage.setItem("pt_last_email", email); } catch { /* ignore */ }
      await login(r.token); nav("/");
    } catch (x: any) { setErr(x.message); setPin(""); } finally { setBusy(false); }
  };
  const onPin = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); setPin(d); if (d.length === 4 && email) setTimeout(() => submit(), 50); };

  return (
    <Shell>
      <div className="card p-6">
        <div className="mb-4 grid grid-cols-2 rounded-xl border border-line p-1 text-sm">
          <button type="button" onClick={() => setMode("password")} className={`flex items-center justify-center gap-2 rounded-lg py-2 font-semibold ${mode === "password" ? "bg-ink-500 text-slate-100" : "text-slate-400"}`}><Lock size={14} /> Password</button>
          <button type="button" onClick={() => setMode("pin")} className={`flex items-center justify-center gap-2 rounded-lg py-2 font-semibold ${mode === "pin" ? "bg-ink-500 text-slate-100" : "text-slate-400"}`}><KeyRound size={14} /> 4-digit PIN</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="rounded-lg bg-sell/10 px-3 py-2 text-sm text-sell">{err}</div>}
          <div><label className="label">Email</label><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          {mode === "password" ? (
            <div><label className="label">Password</label>
              <div className="relative"><input className="input pr-10" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="absolute right-3 top-3 text-slate-400" onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
          ) : (
            <div><label className="label">PIN</label>
              <input ref={pinRef} className="input text-center font-mono text-2xl tracking-[0.6em]" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="one-time-code" placeholder="••••" value={pin} onChange={(e) => onPin(e.target.value)} required />
              <div className="mt-2 flex justify-center gap-2">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < pin.length ? "bg-gold" : "bg-ink-500"}`} />)}</div>
              <p className="mt-2 text-center text-xs text-slate-500">Set your PIN in Settings after signing in with your password.</p></div>
          )}
          <button className="btn-gold w-full" disabled={busy}><LogIn size={16} /> {busy ? "Signing in…" : "Sign in"}</button>
        </form>
        {opts?.signup !== false && <p className="mt-4 text-center text-sm text-slate-400">New here? <Link to="/signup" className="font-semibold text-gold hover:underline"><UserPlus size={14} className="mb-0.5 inline" /> Create a free account</Link></p>}
      </div>
    </Shell>
  );
}

export function Shell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-900 p-4"
      style={{ backgroundImage: "radial-gradient(1000px 500px at 80% -10%, rgba(231,178,60,.10), transparent 60%)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo className="mx-auto h-14 w-14" />
          <h1 className="mt-3 font-display text-2xl font-700">Poli<span className="text-gold">Trade</span> AI</h1>
          <p className="mt-1 text-sm text-slate-400">{title ?? "Congressional stock trades, with AI signals & alerts."}</p>
        </div>
        {children}
        <p className="mt-4 text-center text-xs text-slate-600"><a className="underline" href="/faq">FAQ</a> · <a className="underline" href="/privacy">Privacy</a> · <a className="underline" href="/terms">Terms</a> · <a className="underline" href="/disclaimer">Disclaimer</a></p>
      </div>
    </div>
  );
}
