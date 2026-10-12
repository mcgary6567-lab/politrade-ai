import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../App";
import Logo from "../components/Logo";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api<{ token: string }>("/auth/login", { body: { email, password } }); await login(r.token); nav("/"); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink-900 p-4"
      style={{ backgroundImage: "radial-gradient(1000px 500px at 80% -10%, rgba(231,178,60,.10), transparent 60%)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo className="mx-auto h-14 w-14" />
          <h1 className="mt-3 font-display text-2xl font-700">Poli<span className="text-gold">Trade</span> AI</h1>
          <p className="mt-1 text-sm text-slate-400">Congressional stock trades, with AI alerts.</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          {err && <div className="rounded-lg bg-sell/10 px-3 py-2 text-sm text-sell">{err}</div>}
          <div><label className="label">Email</label><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="label">Password</label><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <button className="btn-gold w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="text-center text-xs text-slate-500">Demo: admin@politrade.ai · politrade123</p>
        </form>
        <p className="mt-4 text-center text-xs text-slate-600"><a className="underline" href="/privacy">Privacy</a> · <a className="underline" href="/terms">Terms</a> · <a className="underline" href="/disclaimer">Disclaimer</a></p>
      </div>
    </div>
  );
}
