import { useEffect, useState } from "react";
import { Send, MessageCircle, Mail, Eye, EyeOff, Trash2, Plus, CheckCircle2, XCircle, Crown, UserCog, Bell, ListChecks, UserRound, History, Save, Link2, Unlink, FlaskConical, Zap, KeyRound, Sun, Moon, Monitor, SunMoon } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../App";
import { Field, Select, toast } from "../components/ui";
import { useProPrice } from "../lib/plan";
import { useTheme, type Preference } from "../lib/theme";

/** Light / dark / follow-OS switch; stored in this browser only. */
function Appearance() {
  const { pref, set } = useTheme();
  const opts: [Preference, string, React.ReactNode][] = [["light", "Light", <Sun size={14} />], ["dark", "Dark", <Moon size={14} />], ["system", "System", <Monitor size={14} />]];
  return (
    <div className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display font-600"><SunMoon size={16} className="text-gold" /> Appearance</h2>
      <p className="mb-3 text-xs text-slate-500">Choose how Hillradar looks on this device. "System" follows your OS setting.</p>
      <div className="grid grid-cols-3 gap-2">
        {opts.map(([k, label, icon]) => (
          <button key={k} type="button" onClick={() => set(k)} className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${pref === k ? "border-gold/60 bg-gold/15 text-gold" : "border-line text-slate-300 hover:bg-ink-600"}`} aria-pressed={pref === k}>{icon}{label}</button>
        ))}
      </div>
    </div>
  );
}

/** Member's own account: profile, password, alert channels, watchlist, plan. */
export default function Settings() {
  const { user: authUser } = useAuth();
  const price = useProPrice();
  const [data, setData] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const load = () => api<any>("/me").then(setData).catch((e) => toast.err(e.message));
  useEffect(() => { load(); fetch("/api/branding").then((r) => r.json()).then(setBranding).catch(() => {}); }, []);
  if (!data) return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="card h-40 animate-pulse" />)}</div>;
  const u = data.user;
  return (
    <div className="space-y-5">
      <div><h1 className="flex items-center gap-2 font-display text-2xl font-700"><UserCog size={22} className="text-gold" /> Your settings</h1><p className="text-sm text-slate-400">Account, alert channels and watchlist.</p></div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Channels u={u} transports={data.transports} bot={data.bot} onChange={load} />
          <Watchlist pro={u.pro} />
          <Profile u={u} onChange={load} />
        </div>
        <div className="space-y-5">
          <Appearance />
          <div className="card p-5">
            <h2 className="mb-2 flex items-center gap-2 font-display font-600"><Crown size={16} className="text-gold" /> Your plan</h2>
            <div className="font-display text-2xl font-700">{u.pro ? (u.plan === "Free" ? "Admin" : u.plan) : "Free"}</div>
            {u.planInfo && <div className="text-sm text-slate-400">${(u.planInfo.price_cents / 100).toFixed(0)} / {u.planInfo.interval}</div>}
            <ul className="mt-3 space-y-1 text-sm text-slate-300">{String(u.planInfo?.features ?? "Browse every disclosed trade\nLast 30 days of filings\n1 watchlist item").split("\n").filter(Boolean).map((f: string, i: number) => <li key={i} className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-buy" />{f}</li>)}</ul>
            {!u.pro && (
              <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 p-3 text-sm">
                <b className="text-gold">Pro — {price} / year</b><p className="mt-1 text-slate-300">Full history since 2014, AI Scanning, Investment Plan, instant Telegram / WhatsApp / Email alerts, unlimited watchlist, CSV.</p>
                <a href={`mailto:${branding?.contact ?? ""}?subject=Upgrade to Pro&body=Please upgrade my account (${u.email}) to Pro.`} className="btn-gold mt-3 w-full text-sm">Upgrade to Pro</a>
              </div>
            )}
          </div>
          <div className="card p-5">
            <h2 className="mb-2 flex items-center gap-2 font-display font-600"><History size={15} className="text-gold" /> Your recent alerts</h2>
            <ul className="space-y-1.5 text-xs">
              {data.alerts.map((a: any, i: number) => <li key={i} className="flex items-center gap-2"><span className={a.ok ? "text-buy" : "text-sell"}>{a.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}</span><span className="capitalize text-slate-400">{a.channel}</span><span className="truncate">{a.politician} {a.tx_type} {a.ticker}</span><span className="ml-auto whitespace-nowrap text-slate-500">{a.created_at?.slice(5, 16).replace("T", " ")}</span></li>)}
              {data.signalAlerts?.map((a: any, i: number) => <li key={"s" + i} className="flex items-center gap-2"><span className={a.ok ? "text-buy" : "text-sell"}>{a.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}</span><span className="capitalize text-slate-400">{a.channel}</span><span className="truncate">🚦 Signal {a.ticker} {a.score}/100</span><span className="ml-auto whitespace-nowrap text-slate-500">{a.created_at?.slice(5, 16).replace("T", " ")}</span></li>)}
              {!data.alerts.length && !data.signalAlerts?.length && <li className="text-slate-500">None yet{authUser?.pro ? " — they appear here as new filings and signals arrive." : " — alerts are a Pro feature."}</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Channels({ u, transports, bot, onChange }: { u: any; transports: any; bot: string | null; onChange: () => void }) {
  const [wa, setWa] = useState(u.wa_to ?? "");
  const [em, setEm] = useState(u.alert_email ?? "");
  const [notify, setNotify] = useState(Boolean(u.notify));
  const [notifySig, setNotifySig] = useState(u.notify_signals == null ? true : Boolean(u.notify_signals));
  const [link, setLink] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const save = async () => { setBusy("save"); try { await api("/me", { method: "PUT", body: { wa_to: wa, alert_email: em, notify, notify_signals: notifySig } }); toast.ok("Alert settings saved"); onChange(); } catch (e: any) { toast.err(e.message); } finally { setBusy(""); } };
  const testSignal = async () => { setBusy("sig"); try { const r = await api<any>("/me/test-signal", { method: "POST" }); toast.ok(`Sent #1 signal (${r.ticker}): ` + Object.entries(r.results).map(([k, v]) => `${k} ${v}`).join(" · ")); } catch (e: any) { toast.err(e.message); } finally { setBusy(""); } };
  const test = async () => { setBusy("test"); try { const r = await api<any>("/me/test", { method: "POST" }); toast.ok(Object.entries(r.results).map(([k, v]) => `${k}: ${v}`).join(" · ")); } catch (e: any) { toast.err(e.message); } finally { setBusy(""); } };
  const connectTg = async () => {
    try { const r = await api<any>("/me/telegram/link", { method: "POST" }); setLink(r); window.open(r.url, "_blank"); } catch (e: any) { toast.err(e.message); }
  };
  useEffect(() => {
    if (!link) return;
    const t = setInterval(async () => { const s = await api<any>("/me/telegram/status").catch(() => null); if (s?.linked) { clearInterval(t); setLink(null); toast.ok("Telegram connected ✔"); onChange(); } }, 4000);
    return () => clearInterval(t);
  }, [link]); // eslint-disable-line react-hooks/exhaustive-deps
  const disconnectTg = async () => { await api("/me", { method: "PUT", body: { disconnect_telegram: true } }); onChange(); };

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="flex items-center gap-2 font-display text-lg font-600"><Bell size={17} className="text-gold" /> Alert channels</h2><p className="text-sm text-slate-400">Where to send you a message the moment a lawmaker files a trade that matches your watchlist.{!u.pro && <> <b className="text-gold">Pro feature</b> — you can set them up now; delivery starts when your plan is Pro.</>}</p></div>
        <div className="shrink-0 space-y-1 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Trade alerts <span className="text-xs text-slate-500">(watchlist filings)</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={notifySig} onChange={(e) => setNotifySig(e.target.checked)} /> Signal alerts <span className="text-xs text-slate-500">(new / stronger buy signals)</span></label>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-line p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold"><Send size={16} className="text-sky-400" /> Telegram {u.tg_chat_id && <span className="chip ml-auto border-buy/40 py-0 text-[10px] text-buy">connected</span>}</div>
          {!transports.telegram ? <p className="text-xs text-slate-500">Not enabled on this server yet.</p>
            : u.tg_chat_id ? <button className="btn-ghost w-full text-xs" onClick={disconnectTg}><Unlink size={13} /> Disconnect</button>
            : <>
              <button className="btn-gold w-full text-xs" onClick={connectTg}><Link2 size={13} /> Connect Telegram</button>
              <p className="mt-2 text-xs text-slate-500">{link ? <>Waiting… open <a className="text-gold underline" href={link.url} target="_blank" rel="noreferrer">@{link.bot}</a> and press <b>Start</b>.</> : <>Opens @{bot ?? "our bot"} — press Start and you are linked.</>}</p>
            </>}
        </div>
        <div className="rounded-xl border border-line p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold"><MessageCircle size={16} className="text-buy" /> WhatsApp {u.wa_to && <span className="chip ml-auto border-buy/40 py-0 text-[10px] text-buy">set</span>}</div>
          {!transports.whatsapp ? <p className="text-xs text-slate-500">Not enabled on this server yet.</p>
            : <Field label="Your number (international, no +)"><input className="input font-mono text-sm" placeholder="923001234567" value={wa} onChange={(e) => setWa(e.target.value)} /></Field>}
        </div>
        <div className="rounded-xl border border-line p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold"><Mail size={16} className="text-gold" /> Email {u.alert_email && <span className="chip ml-auto border-buy/40 py-0 text-[10px] text-buy">set</span>}</div>
          {!transports.email ? <p className="text-xs text-slate-500">Not enabled on this server yet.</p>
            : <Field label="Alert email"><input className="input text-sm" type="email" placeholder={u.email} value={em} onChange={(e) => setEm(e.target.value)} /></Field>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button className="btn-ghost whitespace-nowrap text-sm" disabled={busy === "test"} onClick={test}><FlaskConical size={14} /> Send test</button>
        <button className="btn-ghost whitespace-nowrap text-sm" disabled={busy === "sig"} onClick={testSignal} title="Sends the current #1 buy signal to your channels"><Zap size={14} /> Send test signal</button>
        <button className="btn-gold whitespace-nowrap text-sm" disabled={busy === "save"} onClick={save}><Save size={14} /> Save channels</button>
      </div>
    </div>
  );
}

function Watchlist({ pro }: { pro: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [pols, setPols] = useState<any[]>([]);
  const [kind, setKind] = useState("politician");
  const [value, setValue] = useState("");
  const load = () => api<any>("/watchlist").then((r) => setRows(r.rows)).catch(() => {});
  useEffect(() => { load(); api<any>("/politicians?sort=name").then((r) => setPols(r.rows)).catch(() => {}); }, []);
  const add = async () => {
    const v = kind === "any" ? "all" : value.trim(); if (!v) return;
    try { await api("/watchlist", { body: { kind, value: v } }); setValue(""); load(); toast.ok("Added to watchlist"); } catch (e: any) { toast.err(e.message); }
  };
  const label = (w: any) => w.kind === "politician" ? (pols.find((p) => String(p.id) === w.value)?.name ?? w.value) : w.kind === "any" ? "Every new filing" : w.value;
  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-600"><ListChecks size={17} className="text-gold" /> Watchlist</h2>
      <p className="mb-3 text-sm text-slate-400">Get alerted only for these. Leave it empty to be alerted on every new filing.{!pro && " Free plan: 1 item."}</p>
      <div className="flex flex-wrap gap-2">
        <Select value={kind} onChange={(v) => { setKind(v); setValue(""); }} opts={[["politician", "Politician"], ["ticker", "Ticker"], ["party", "Party"], ["any", "Everything"]]} />
        {kind === "politician" && <Select className="max-w-[260px]" value={value} onChange={setValue} opts={[["", "Choose…"], ...pols.map((p) => [String(p.id), p.name] as [string, string])]} />}
        {kind === "ticker" && <input className="input w-32 font-mono uppercase" placeholder="NVDA" value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} />}
        {kind === "party" && <Select value={value} onChange={setValue} opts={[["", "Choose…"], ["Democrat", "Democrat"], ["Republican", "Republican"], ["Independent", "Independent"]]} />}
        <button className="btn-gold text-sm" onClick={add}><Plus size={14} /> Add</button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {rows.map((w) => <li key={w.id} className="chip gap-2 py-1.5"><span className="text-slate-500">{w.kind}</span> {label(w)} <button onClick={async () => { await api(`/watchlist/${w.id}`, { method: "DELETE" }); load(); }} className="text-sell"><Trash2 size={12} /></button></li>)}
        {!rows.length && <li className="text-sm text-slate-500">Empty — you would be alerted on every filing.</li>}
      </ul>
    </div>
  );
}

function Profile({ u, onChange }: { u: any; onChange: () => void }) {
  const [f, setF] = useState({ first_name: u.first_name ?? (u.name ?? "").split(" ")[0] ?? "", last_name: u.last_name ?? (u.name ?? "").split(" ").slice(1).join(" "), email: u.email, password: "", current_password: "" });
  const [pin, setPin] = useState({ pin: "", current_password: "", busy: false });
  const savePin = async (clear = false) => {
    setPin({ ...pin, busy: true });
    try { await api("/me", { method: "PUT", body: { pin: clear ? "" : pin.pin, current_password: pin.current_password } }); toast.ok(clear ? "PIN removed" : "PIN set — you can now sign in with email + PIN"); setPin({ pin: "", current_password: "", busy: false }); onChange(); }
    catch (e: any) { toast.err(e.message); setPin({ ...pin, busy: false }); }
  };
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const body: any = { first_name: f.first_name, last_name: f.last_name, email: f.email, current_password: f.current_password };
      if (f.password) body.password = f.password;
      await api("/me", { method: "PUT", body }); toast.ok("Profile saved"); setF({ ...f, password: "", current_password: "" }); onChange();
    } catch (e: any) { toast.err(e.message); } finally { setBusy(false); }
  };
  return (
    <form className="card p-5" onSubmit={save}>
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-600"><UserRound size={17} className="text-gold" /> Account</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input className="input" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></Field>
          <Field label="Last name"><input className="input" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></Field>
        </div>
        <Field label="Email (sign-in)"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="New password" hint="Leave blank to keep the current one"><div className="relative"><input className="input pr-10" type={show ? "text" : "password"} minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /><button type="button" className="absolute right-3 top-3 text-slate-400" onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></Field>
        <Field label="Current password" hint="Required to change email or password"><input className="input" type="password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} autoComplete="current-password" /></Field>
      </div>
      <div className="mt-3 flex justify-end"><button className="btn-gold text-sm" disabled={busy}><Save size={14} /> Save account</button></div>
      <div className="mt-5 rounded-xl border border-line p-4">
        <h3 className="flex items-center gap-2 font-display font-600"><KeyRound size={16} className="text-gold" /> Quick sign-in PIN {u.has_pin ? <span className="chip border-buy/40 py-0 text-[10px] text-buy">set</span> : <span className="chip py-0 text-[10px]">not set</span>}</h3>
        <p className="mt-1 text-xs text-slate-400">A 4-digit PIN lets you sign in fast on your own phone or computer (email + PIN). Your password still works, and the PIN locks for 15 minutes after 5 wrong tries.</p>
        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[120px_1fr_auto_auto]">
          <input className="input text-center font-mono text-lg tracking-[0.4em]" inputMode="numeric" maxLength={4} placeholder="••••" value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
          <input className="input" type="password" placeholder="Current password" autoComplete="current-password" value={pin.current_password} onChange={(e) => setPin({ ...pin, current_password: e.target.value })} />
          <button type="button" className="btn-gold text-sm" disabled={pin.busy || pin.pin.length !== 4 || !pin.current_password} onClick={() => savePin(false)}><Save size={14} /> {u.has_pin ? "Change PIN" : "Set PIN"}</button>
          {u.has_pin && <button type="button" className="btn-ghost text-sm" disabled={pin.busy || !pin.current_password} onClick={() => savePin(true)}>Remove</button>}
        </div>
      </div>
    </form>
  );
}
