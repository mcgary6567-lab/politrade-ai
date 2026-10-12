import { UserPlus, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../App";
import { Shell } from "./Login";

export default function Signup() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", password: "", confirm: "", accept: false });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/auth/options").then((r) => r.json()).then((o) => setOpen(o.signup)).catch(() => setOpen(true)); }, []);
  if (user) return <Navigate to="/" replace />;
  const up = (k: string, v: any) => setF({ ...f, [k]: v });
  const strength = f.password.length >= 12 && /\d/.test(f.password) && /[^a-z0-9]/i.test(f.password) ? 3 : f.password.length >= 8 && /\d/.test(f.password) ? 2 : f.password.length >= 8 ? 1 : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (f.password !== f.confirm) return setErr("Passwords do not match");
    if (!f.accept) return setErr("Please accept the Terms and Privacy Policy");
    setBusy(true);
    try { const r = await api<{ token: string }>("/auth/signup", { body: { first_name: f.first_name, last_name: f.last_name, email: f.email, password: f.password, accept: true } }); await login(r.token); nav("/"); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <Shell title="Create your free account — upgrade to Pro any time.">
      <form onSubmit={submit} className="card space-y-4 p-6">
        {open === false && <div className="rounded-lg bg-gold/10 px-3 py-2 text-sm text-gold">Sign-up is currently closed. <a className="underline" href="/contact">Contact us</a> for an account.</div>}
        {err && <div className="rounded-lg bg-sell/10 px-3 py-2 text-sm text-sell">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">First name</label><input className="input" autoComplete="given-name" value={f.first_name} onChange={(e) => up("first_name", e.target.value)} required maxLength={40} /></div>
          <div><label className="label">Last name</label><input className="input" autoComplete="family-name" value={f.last_name} onChange={(e) => up("last_name", e.target.value)} required maxLength={40} /></div>
        </div>
        <div><label className="label">Email</label><input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => up("email", e.target.value)} required /></div>
        <div><label className="label">Password</label>
          <div className="relative"><input className="input pr-10" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} value={f.password} onChange={(e) => up("password", e.target.value)} required />
            <button type="button" className="absolute right-3 top-3 text-slate-400" onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          <div className="mt-1.5 flex gap-1">{[1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded ${strength >= i ? (strength === 3 ? "bg-buy" : strength === 2 ? "bg-gold" : "bg-sell") : "bg-ink-500"}`} />)}</div>
          <p className="mt-1 text-xs text-slate-500">At least 8 characters; add numbers and symbols for a stronger password.</p></div>
        <div><label className="label">Confirm password</label><input className="input" type={show ? "text" : "password"} autoComplete="new-password" value={f.confirm} onChange={(e) => up("confirm", e.target.value)} required /></div>
        <label className="flex items-start gap-2 text-xs text-slate-400"><input type="checkbox" className="mt-0.5" checked={f.accept} onChange={(e) => up("accept", e.target.checked)} /> <span>I am 18 or older and agree to the <a className="text-gold underline" href="/terms" target="_blank">Terms &amp; Conditions</a> and <a className="text-gold underline" href="/privacy" target="_blank">Privacy Policy</a>, and I understand this is research, not financial advice.</span></label>
        <button className="btn-gold w-full" disabled={busy || open === false}><UserPlus size={16} /> {busy ? "Creating account…" : "Create free account"}</button>
        <ul className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
          {["Latest 30 days of filings", "Top AI signal", "1 watchlist item", "Install as an app"].map((t) => <li key={t} className="flex items-center gap-1"><CheckCircle2 size={11} className="text-buy" /> {t}</li>)}
        </ul>
        <p className="text-center text-sm text-slate-400">Already have an account? <Link to="/login" className="font-semibold text-gold hover:underline">Sign in</Link></p>
      </form>
    </Shell>
  );
}
