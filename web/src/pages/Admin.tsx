import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { LayoutDashboard, Users, CreditCard, Plug, Database, Bell, Plus, Pencil, Trash2, Send, RefreshCw, Eye, EyeOff, CheckCircle2, XCircle, Bot, MessageCircle, Mail, Rss, Palette, Upload, Trash } from "lucide-react";
import { api, ago } from "../lib/api";
import { useAuth } from "../App";
import { Modal, Field, Select, KPI, toast, Empty } from "../components/ui";
import IssuerLogo from "../components/IssuerLogo";

const TABS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/plans", label: "Plans", icon: CreditCard },
  { to: "/admin/integrations", label: "Integrations", icon: Plug },
  { to: "/admin/data", label: "Data feed", icon: Database },
  { to: "/admin/alerts", label: "Alerts log", icon: Bell },
];

export default function Admin() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-2xl font-700">Admin panel</h1><p className="text-sm text-slate-400">Control users, plans, API keys, alert channels and the data feed — no redeploy needed.</p></div>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-ink-700/70 p-1">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${isActive ? "bg-gold text-ink-900" : "text-slate-300 hover:bg-ink-600"}`}>
            <t.icon size={15} /> {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="users" element={<UsersTab />} />
        <Route path="plans" element={<PlansTab />} />
        <Route path="integrations" element={<IntegrationsTab />} />
        <Route path="data" element={<DataTab />} />
        <Route path="alerts" element={<AlertsTab />} />
      </Routes>
    </div>
  );
}

/* ------------------------------------------------------------------ overview */
function Overview() {
  const [o, setO] = useState<any>(null);
  useEffect(() => { api("/admin/overview").then(setO).catch((e) => toast.err(e.message)); }, []);
  if (!o) return <p className="text-slate-500">Loading…</p>;
  const li = o.lastIngest;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KPI label="Users" value={o.users} sub={`${o.activeUsers} active`} />
        <KPI label="Plans" value={o.plans} sub="active" />
        <KPI label="Trades" value={o.trades.toLocaleString()} sub={`${o.politicians} politicians · ${o.issuers} issuers`} />
        <KPI label="Alerts (24h)" value={o.alerts24h} tone="text-gold" sub={o.alertsFailed ? <span className="text-sell">{o.alertsFailed} failed total</span> : "none failed"} />
        <KPI label="AI insight" value={o.ai ? "On" : "Off"} tone={o.ai ? "text-buy" : "text-slate-500"} />
        <KPI label="Data feed" value={o.feed.url ? "Live" : "Demo"} tone={o.feed.url ? "text-buy" : "text-gold"} sub={o.feed.url ? o.feed.cron : "no URL set"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-4">
          <h2 className="mb-3 font-display font-600">Channels</h2>
          <ul className="space-y-2 text-sm">
            {(["telegram", "whatsapp", "email"] as const).map((c) => <li key={c} className="flex items-center justify-between capitalize"><span>{c}</span>{o.channels[c] ? <span className="flex items-center gap-1 text-buy"><CheckCircle2 size={14} /> connected</span> : <span className="flex items-center gap-1 text-slate-500"><XCircle size={14} /> not set</span>}</li>)}
            <li className="flex items-center justify-between border-t border-line pt-2"><span>Alerts</span><span className={o.feed.enabled ? "text-buy" : "text-sell"}>{o.feed.enabled ? "enabled" : "paused"}</span></li>
          </ul>
          <Link to="/admin/integrations" className="btn-gold mt-4 w-full text-sm">Configure integrations</Link>
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-display font-600">Last ingest</h2>
          {li ? (
            <dl className="space-y-1.5 text-sm">
              <Row k="Started" v={li.started_at?.replace("T", " ").slice(0, 16)} />
              <Row k="Source" v={<span className="break-all text-xs">{li.source}</span>} />
              <Row k="Fetched / added" v={`${li.fetched ?? "—"} / ${li.added ?? "—"}`} />
              <Row k="Status" v={li.error ? <span className="text-sell">{li.error}</span> : li.finished_at ? <span className="text-buy">ok</span> : "running"} />
            </dl>
          ) : <p className="text-sm text-slate-500">No ingest run yet. Set a feed URL in Data feed and run it.</p>}
          <Link to="/admin/data" className="btn-ghost mt-4 w-full text-sm">Open data feed</Link>
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-display font-600">Recent users</h2>
          <ul className="space-y-2 text-sm">
            {o.recentUsers.map((u: any) => <li key={u.id} className="flex items-center justify-between"><span className="truncate">{u.name || u.email}<span className="ml-1 text-xs text-slate-500">· {u.role}</span></span><span className="text-xs text-slate-500">{u.last_login ? `seen ${ago(u.last_login)}` : "never signed in"}</span></li>)}
          </ul>
          <Link to="/admin/users" className="btn-ghost mt-4 w-full text-sm">Manage users</Link>
        </div>
      </div>
      <div className="card p-4 text-sm text-slate-300">
        <h2 className="mb-2 font-display font-600">Quick start</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li><b>Integrations</b> → paste your Telegram bot token + chat ID, WhatsApp Cloud API token, email provider key, and an AI key (Claude or Gemini). Press <i>Test</i> on each.</li>
          <li><b>Data feed</b> → paste a public STOCK-Act disclosure JSON URL, pick a schedule, press <i>Run now</i>. New filings are alerted automatically from then on.</li>
          <li><b>Users & Plans</b> → add members, assign a plan, suspend or reset passwords any time.</li>
          <li>Once real data flows, press <i>Clear demo data</i> in Data feed to remove the fictional sample.</li>
        </ol>
      </div>
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="flex items-start justify-between gap-3"><dt className="text-slate-400">{k}</dt><dd className="text-right">{v}</dd></div>;

/* --------------------------------------------------------------------- users */
function UsersTab() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<any>(null); // null | {} (new) | row
  const load = () => Promise.all([api<any>(`/admin/users?q=${encodeURIComponent(q)}`), api<any>("/admin/plans")]).then(([u, p]) => { setRows(u.rows); setPlans(p.rows); }).catch((e) => toast.err(e.message));
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (f: any) => {
    const body: any = { email: f.email, name: f.name, role: f.role, status: f.status, plan_id: f.plan_id ? Number(f.plan_id) : null };
    if (f.password) body.password = f.password;
    try {
      if (f.id) await api(`/admin/users/${f.id}`, { method: "PUT", body }); else await api("/admin/users", { body });
      toast.ok(f.id ? "User updated" : "User created"); setEdit(null); load();
    } catch (e: any) { toast.err(e.message); }
  };
  const del = async (u: any) => {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    try { await api(`/admin/users/${u.id}`, { method: "DELETE" }); toast.ok("User deleted"); load(); } catch (e: any) { toast.err(e.message); }
  };
  const toggle = async (u: any) => {
    try { await api(`/admin/users/${u.id}`, { method: "PUT", body: { status: u.status === "active" ? "suspended" : "active" } }); load(); } catch (e: any) { toast.err(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Search email or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-slate-500">{rows.length} users</span>
        <button className="btn-gold ml-auto text-sm" onClick={() => setEdit({ role: "member", status: "active" })}><Plus size={15} /> Add user</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-line"><tr><th className="th">User</th><th className="th">Role</th><th className="th">Plan</th><th className="th">Status</th><th className="th">Last login</th><th className="th">Watchlist</th><th className="th">Joined</th><th className="th text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-ink-700/40">
                <td className="td"><div className="font-semibold">{u.name || "—"}</div><div className="text-xs text-slate-400">{u.email}{u.id === me?.id && <span className="ml-1 text-gold">(you)</span>}</div></td>
                <td className="td"><span className={`chip ${u.role === "admin" ? "border-gold/50 text-gold" : ""}`}>{u.role}</span></td>
                <td className="td text-sm">{u.plan ?? <span className="text-slate-500">none</span>}</td>
                <td className="td"><button onClick={() => toggle(u)} className={`chip ${u.status === "active" ? "border-buy/40 text-buy" : "border-sell/40 text-sell"}`} title="Click to toggle">{u.status}</button></td>
                <td className="td text-sm text-slate-400">{u.last_login ? ago(u.last_login) : "never"}</td>
                <td className="td text-sm text-slate-400">{u.watch}</td>
                <td className="td text-sm text-slate-400">{u.created_at?.slice(0, 10)}</td>
                <td className="td text-right"><button className="btn-ghost px-2 py-1.5" onClick={() => setEdit({ ...u, password: "" })} title="Edit"><Pencil size={14} /></button> <button className="btn-ghost px-2 py-1.5 text-sell" onClick={() => del(u)} title="Delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8}><Empty text="No users found." /></td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <UserModal f={edit} plans={plans} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function UserModal({ f, plans, onClose, onSave }: { f: any; plans: any[]; onClose: () => void; onSave: (f: any) => void }) {
  const [v, setV] = useState<any>({ ...f, plan_id: f.plan_id ?? "" });
  const [show, setShow] = useState(false);
  const up = (k: string, x: any) => setV({ ...v, [k]: x });
  return (
    <Modal title={f.id ? "Edit user" : "Add user"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(v); }}>
        <Field label="Email"><input className="input" type="email" required value={v.email ?? ""} onChange={(e) => up("email", e.target.value)} /></Field>
        <Field label="Name"><input className="input" value={v.name ?? ""} onChange={(e) => up("name", e.target.value)} /></Field>
        <Field label={f.id ? "New password (leave blank to keep)" : "Password"} hint="Minimum 6 characters">
          <div className="relative"><input className="input pr-10" type={show ? "text" : "password"} required={!f.id} minLength={6} value={v.password ?? ""} onChange={(e) => up("password", e.target.value)} autoComplete="new-password" />
            <button type="button" className="absolute right-3 top-3 text-slate-400" onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Role"><Select className="w-full" value={v.role} onChange={(x) => up("role", x)} opts={[["member", "Member"], ["admin", "Admin"]]} /></Field>
          <Field label="Status"><Select className="w-full" value={v.status} onChange={(x) => up("status", x)} opts={[["active", "Active"], ["suspended", "Suspended"]]} /></Field>
          <Field label="Plan"><Select className="w-full" value={String(v.plan_id ?? "")} onChange={(x) => up("plan_id", x)} opts={[["", "None"], ...plans.map((p) => [String(p.id), p.name] as [string, string])]} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-gold">Save</button></div>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------------- plans */
function PlansTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const load = () => api<any>("/admin/plans").then((r) => setRows(r.rows)).catch((e) => toast.err(e.message));
  useEffect(() => { load(); }, []);
  const save = async (f: any) => {
    const body = { name: f.name, price_cents: Math.round(Number(f.price || 0) * 100), interval: f.interval, features: f.features, active: Boolean(f.active) };
    try {
      if (f.id) await api(`/admin/plans/${f.id}`, { method: "PUT", body }); else await api("/admin/plans", { body });
      toast.ok("Plan saved"); setEdit(null); load();
    } catch (e: any) { toast.err(e.message); }
  };
  const del = async (p: any) => {
    if (!confirm(`Delete plan "${p.name}"? Members on it will be set to no plan.`)) return;
    try { await api(`/admin/plans/${p.id}`, { method: "DELETE" }); toast.ok("Plan deleted"); load(); } catch (e: any) { toast.err(e.message); }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><p className="text-sm text-slate-400">Payment plans shown to members. Pricing is in USD; connect your payment provider link in the features text or your checkout page.</p>
        <button className="btn-gold text-sm" onClick={() => setEdit({ interval: "month", active: true, price: "" })}><Plus size={15} /> Add plan</button></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <div key={p.id} className={`card relative p-5 ${p.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between"><h3 className="font-display text-lg font-700">{p.name}</h3><span className={`chip ${p.active ? "border-buy/40 text-buy" : "border-sell/40 text-sell"}`}>{p.active ? "active" : "hidden"}</span></div>
            <div className="mt-2 font-display text-3xl font-700 text-gold">${(p.price_cents / 100).toFixed(p.price_cents % 100 ? 2 : 0)}<span className="text-sm font-normal text-slate-400"> / {p.interval}</span></div>
            <ul className="mt-3 space-y-1 text-sm text-slate-300">{String(p.features ?? "").split("\n").filter(Boolean).map((f: string, i: number) => <li key={i} className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-buy" />{f}</li>)}</ul>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{p.members} member{p.members === 1 ? "" : "s"}</span>
              <span className="flex gap-1"><button className="btn-ghost px-2 py-1" onClick={() => setEdit({ ...p, price: p.price_cents / 100, active: Boolean(p.active) })}><Pencil size={13} /></button><button className="btn-ghost px-2 py-1 text-sell" onClick={() => del(p)}><Trash2 size={13} /></button></span></div>
          </div>
        ))}
        {!rows.length && <Empty text="No plans yet." />}
      </div>
      {edit && (
        <Modal title={edit.id ? "Edit plan" : "Add plan"} onClose={() => setEdit(null)}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(edit); }}>
            <Field label="Name"><input className="input" required value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (USD)"><input className="input" type="number" min={0} step="0.01" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
              <Field label="Billing"><Select className="w-full" value={edit.interval} onChange={(x) => setEdit({ ...edit, interval: x })} opts={[["month", "Monthly"], ["year", "Yearly"], ["lifetime", "Lifetime"]]} /></Field>
            </div>
            <Field label="Features (one per line)"><textarea className="input min-h-[110px]" value={edit.features ?? ""} onChange={(e) => setEdit({ ...edit, features: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(edit.active)} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Visible / active</label>
            <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn-gold">Save</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- integrations */
const GROUPS: { id: string; title: string; icon: any; blurb: string; test?: string; help: string }[] = [
  { id: "ai", title: "AI insight", icon: Bot, blurb: "Writes a one-line plain-English note for every new trade. Add a Claude key or a Google Gemini key (either works).", test: "ai", help: "Claude: console.anthropic.com → API keys. Gemini: aistudio.google.com → Get API key." },
  { id: "telegram", title: "Telegram", icon: Send, blurb: "Instant alerts to a Telegram chat, group or channel.", test: "telegram", help: "Create a bot with @BotFather → token. Add the bot to your group/channel, then get the chat ID (e.g. via @userinfobot, or -100… for channels)." },
  { id: "whatsapp", title: "WhatsApp", icon: MessageCircle, blurb: "Alerts via the official WhatsApp Cloud API (Meta).", test: "whatsapp", help: "developers.facebook.com → your app → WhatsApp → API setup: copy the permanent access token and Phone number ID. Recipient must be in international format without +." },
  { id: "email", title: "Email", icon: Mail, blurb: "Alerts by email through any HTTP email provider (Resend, Mailgun, SendGrid-style JSON API).", test: "email", help: "For Resend: URL https://api.resend.com/emails, API key re_…, From must be a verified domain sender." },
  { id: "brand", title: "Branding & contact", icon: Palette, blurb: "Name shown in the app, footer contact and social links.", help: "Changes apply immediately to the header, footer and alert messages." },
];

function IntegrationsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<any>({ channels: {}, ai: false });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>("");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const load = () => api<any>("/admin/settings").then((r) => { setRows(r.rows); setStatus(r); setDraft({}); }).catch((e) => toast.err(e.message));
  useEffect(() => { load(); }, []);

  const save = async (group: string) => {
    const values: Record<string, string> = {};
    for (const r of rows) if (r.group === group && draft[r.key] !== undefined) values[r.key] = draft[r.key];
    if (!Object.keys(values).length) return toast.ok("Nothing changed");
    setBusy(group);
    try { const r = await api<any>("/admin/settings", { method: "PUT", body: { values } }); setRows(r.rows); setStatus(r); setDraft((d) => { const n = { ...d }; for (const k of Object.keys(values)) delete n[k]; return n; }); toast.ok("Saved"); }
    catch (e: any) { toast.err(e.message); } finally { setBusy(""); }
  };
  const test = async (ch: string) => {
    setBusy("test-" + ch);
    try {
      const r = await api<any>(`/admin/test/${ch}`, { method: "POST" });
      if (ch === "ai") toast.ok(`AI OK (${r.provider}, ${r.ms} ms): ${r.note}`);
      else { const info = r.results[ch]; info.startsWith("sent") ? toast.ok(`${ch}: message sent ✔`) : toast.err(`${ch}: ${info}`); }
    } catch (e: any) { toast.err(e.message); } finally { setBusy(""); }
  };
  const on = (g: string) => g === "ai" ? status.ai : status.channels?.[g];

  return (
    <div className="space-y-4">
      <div className="card p-3 text-sm text-slate-400">Values saved here override environment variables and apply instantly. Secrets are stored on your server and shown masked; leave a masked field untouched to keep it.</div>
      {GROUPS.map((g) => {
        const fields = rows.filter((r) => r.group === g.id);
        if (!fields.length) return null;
        const dirty = fields.some((f) => draft[f.key] !== undefined);
        return (
          <div key={g.id} className="card p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${on(g.id) ? "bg-buy/15 text-buy" : "bg-ink-600 text-slate-400"}`}><g.icon size={18} /></span>
              <div className="flex-1 basis-[240px]"><h2 className="font-display text-lg font-600">{g.title} {g.id !== "brand" && (on(g.id) ? <span className="chip ml-1 border-buy/40 text-buy">connected</span> : <span className="chip ml-1">not set</span>)}</h2><p className="text-sm text-slate-400">{g.blurb}</p></div>
              <div className="flex gap-2">
                {g.test && <button className="btn-ghost text-sm" disabled={busy === "test-" + g.test} onClick={() => test(g.test!)}><Send size={14} /> {busy === "test-" + g.test ? "Testing…" : "Test"}</button>}
                <button className="btn-gold text-sm" disabled={!dirty || busy === g.id} onClick={() => save(g.id)}>{busy === g.id ? "Saving…" : "Save"}</button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {fields.map((f) => (
                <Field key={f.key} label={f.label} hint={f.fromEnv && draft[f.key] === undefined ? "from environment variable" : undefined}>
                  <div className="relative">
                    <input className="input pr-10 font-mono text-sm" type={f.secret && !reveal[f.key] ? "password" : "text"} placeholder={f.secret ? "paste key…" : ""} value={draft[f.key] ?? f.value ?? ""}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} onFocus={() => { if (f.secret && draft[f.key] === undefined && f.value) setDraft({ ...draft, [f.key]: "" }); }} autoComplete="off" />
                    {f.secret && <button type="button" className="absolute right-3 top-3 text-slate-400" onClick={() => setReveal({ ...reveal, [f.key]: !reveal[f.key] })}>{reveal[f.key] ? <EyeOff size={15} /> : <Eye size={15} />}</button>}
                  </div>
                </Field>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">{g.help}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- data */
function DataTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [json, setJson] = useState("");
  const [presets, setPresets] = useState<any[]>([]);
  const load = () => Promise.all([api<any>("/admin/settings"), api<any>("/admin/ingest/log"), api<any>("/admin/ingest/presets")]).then(([s, l, p]) => { setRows(s.rows.filter((r: any) => r.group === "feed")); setLog(l.rows); setPresets(p.presets); setDraft({}); }).catch((e) => toast.err(e.message));
  useEffect(() => { load(); }, []);
  const val = (k: string) => draft[k] ?? rows.find((r) => r.key === k)?.value ?? "";
  const save = async () => {
    setBusy("save");
    try { await api("/admin/settings", { method: "PUT", body: { values: draft } }); toast.ok("Feed settings saved — scheduler picks them up within a minute"); load(); } catch (e: any) { toast.err(e.message); } finally { setBusy(""); }
  };
  const run = async () => {
    setBusy("run");
    try {
      const r = await api<any>("/admin/ingest/run", { method: "POST" });
      toast.ok(`Fetched ${r.fetched} records, ${r.added} new trades added`);
      for (const e of r.errors ?? []) toast.err(e);
      load();
    } catch (e: any) { toast.err(e.message); load(); } finally { setBusy(""); }
  };
  const sync = async () => {
    setBusy("sync");
    try { const r = await api<any>("/admin/politicians/sync", { method: "POST" }); toast.ok(`Directory: ${r.legislators} legislators, ${r.matched} matched, ${r.updated} profiles updated (party / state / photo)`); } catch (e: any) { toast.err(e.message); } finally { setBusy(""); }
  };
  const currentPreset = presets.find((p) => p.urls.join("\n") === val("feed.url").split(/[\n,]+/).map((x: string) => x.trim()).filter(Boolean).join("\n"))?.id ?? "";
  const applyPreset = (id: string) => { const p = presets.find((x) => x.id === id); if (p) setDraft({ ...draft, "feed.url": p.urls.join("\n") }); };
  const preset = presets.find((p) => p.id === currentPreset);
  const importJson = async () => {
    setBusy("import");
    try {
      const parsed = JSON.parse(json);
      const r = await api<any>("/admin/ingest/import", { body: { rows: Array.isArray(parsed) ? parsed : parsed.transactions ?? parsed.data ?? [] } });
      toast.ok(`Imported ${r.added} new trades out of ${r.fetched}`); setJson(""); load();
    } catch (e: any) { toast.err(e.message.startsWith("Unexpected") || e.message.includes("JSON") ? "Invalid JSON" : e.message); } finally { setBusy(""); }
  };
  const clearDemo = async () => {
    if (!confirm("Remove all fictional demo trades? Real ingested data is kept.")) return;
    try { const r = await api<any>("/admin/demo/clear", { method: "POST" }); toast.ok(`Removed ${r.removed} demo trades`); } catch (e: any) { toast.err(e.message); }
  };
  const enabled = val("alerts.enabled") !== "0";

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-600 text-gold"><Rss size={18} /></span>
          <div className="flex-1 basis-[240px]"><h2 className="font-display text-lg font-600">Real data — public disclosure feeds</h2><p className="text-sm text-slate-400">US lawmakers must file every stock trade (STOCK Act). Pick a source below — the app polls it on schedule, stores every real trade, writes the AI note and pushes alerts. Same official filings every trade tracker uses.</p></div>
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" disabled={busy === "run"} onClick={run}><RefreshCw size={14} className={busy === "run" ? "animate-spin" : ""} /> {busy === "run" ? "Fetching…" : "Run now"}</button>
            <button className="btn-gold text-sm" disabled={!Object.keys(draft).length || busy === "save"} onClick={save}>Save</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Source preset">
            <Select className="w-full" value={currentPreset} onChange={applyPreset} opts={[["", currentPreset ? "Custom URLs" : "Choose a source…"], ...presets.map((p) => [p.id, p.name] as [string, string])]} />
            {preset && <span className="mt-1 block text-xs text-slate-500">{preset.note}</span>}
          </Field>
          <Field label="Feed API key" hint="Only for sources that need one (replaces {KEY} in the URLs). Stored masked.">
            <input className="input font-mono text-sm" type="password" placeholder={rows.find((r) => r.key === "feed.api_key")?.set ? "•••• saved — type to replace" : "paste key if the source needs one"} value={draft["feed.api_key"] ?? ""} onChange={(e) => setDraft({ ...draft, "feed.api_key": e.target.value })} autoComplete="off" />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_200px_160px]">
          <Field label="Feed URL(s) — one per line" hint="Each must return JSON (array or {transactions:[…]}). House/Senate open-dataset, FMP and generic field names are detected automatically; a URL containing “house”/“senate” sets the chamber.">
            <textarea className="input min-h-[88px] font-mono text-xs" placeholder={"https://…/house_transactions.json\nhttps://…/senate_transactions.json"} value={val("feed.url")} onChange={(e) => setDraft({ ...draft, "feed.url": e.target.value })} /></Field>
          <Field label="Schedule (cron)" hint="e.g. */30 * * * * = every 30 min">
            <Select className="w-full" value={["*/15 * * * *", "*/30 * * * *", "0 * * * *", "0 */6 * * *", "0 8 * * *"].includes(val("feed.cron")) ? val("feed.cron") : "custom"} onChange={(x) => x !== "custom" && setDraft({ ...draft, "feed.cron": x })}
              opts={[["*/15 * * * *", "Every 15 min"], ["*/30 * * * *", "Every 30 min"], ["0 * * * *", "Hourly"], ["0 */6 * * *", "Every 6 hours"], ["0 8 * * *", "Daily 08:00 UTC"], ["custom", "Custom…"]]} />
            <input className="input mt-2 font-mono text-sm" value={val("feed.cron")} onChange={(e) => setDraft({ ...draft, "feed.cron": e.target.value })} /></Field>
          <Field label="Alerts">
            <button type="button" className={`btn w-full border ${enabled ? "border-buy/40 bg-buy/10 text-buy" : "border-sell/40 bg-sell/10 text-sell"}`} onClick={() => setDraft({ ...draft, "alerts.enabled": enabled ? "0" : "1" })}>{enabled ? "Enabled" : "Paused"}</button>
            <span className="mt-1 block text-xs text-slate-500">Pause to ingest history without spamming channels.</span></Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-800/60 p-3">
          <div className="flex-1 basis-[240px] text-sm"><b>Politicians directory</b> <span className="text-slate-400">— fills party, state, chamber and official photo for every politician in your trades from the public <span className="font-mono text-xs">congress-legislators</span> dataset. Run after the first ingest.</span></div>
          <button className="btn-ghost text-sm" disabled={busy === "sync"} onClick={sync}><RefreshCw size={14} className={busy === "sync" ? "animate-spin" : ""} /> {busy === "sync" ? "Syncing…" : "Sync directory"}</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-display font-600"><Upload size={16} className="text-gold" /> Manual import</h2>
          <p className="mb-3 text-sm text-slate-400">Paste a JSON array of trade records (same shape as the feed). Duplicates are skipped; imports never trigger alerts.</p>
          <textarea className="input min-h-[140px] font-mono text-xs" placeholder='[{"representative":"…","ticker":"AAPL","type":"purchase","amount":"$1,001 - $15,000","transaction_date":"2025-01-15","disclosure_date":"2025-02-01"}]' value={json} onChange={(e) => setJson(e.target.value)} />
          <div className="mt-2 flex justify-between">
            <button className="btn-ghost text-sm text-sell" onClick={clearDemo}><Trash size={14} /> Clear demo data</button>
            <button className="btn-gold text-sm" disabled={!json.trim() || busy === "import"} onClick={importJson}>{busy === "import" ? "Importing…" : "Import"}</button>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3 font-display font-600">Ingest history</div>
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="sticky top-0 bg-ink-700"><tr><th className="th">When</th><th className="th">Source</th><th className="th text-right">Fetched</th><th className="th text-right">Added</th><th className="th">Result</th></tr></thead>
              <tbody className="divide-y divide-line">
                {log.map((l) => <tr key={l.id}><td className="td whitespace-nowrap text-slate-400">{l.started_at?.replace("T", " ").slice(5, 16)}</td><td className="td max-w-[200px] truncate text-xs text-slate-400" title={l.source}>{l.source}</td><td className="td text-right font-mono">{l.fetched ?? "—"}</td><td className="td text-right font-mono text-buy">{l.added ?? "—"}</td><td className="td">{l.error ? <span className="text-xs text-sell">{l.error}</span> : l.finished_at ? <span className="text-buy">ok</span> : "…"}</td></tr>)}
                {!log.length && <tr><td colSpan={5}><Empty text="No runs yet." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- alerts */
function AlertsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [sig, setSig] = useState<any[]>([]);
  const [busy, setBusy] = useState(0);
  const [sigBusy, setSigBusy] = useState("");
  const load = () => Promise.all([api<any>("/admin/alerts/log"), api<any>("/admin/signals/log")]).then(([a, s]) => { setRows(a.rows); setSig(s.rows); }).catch((e) => toast.err(e.message));
  useEffect(() => { load(); }, []);
  const checkSignals = async (mode: "dry" | "run" | "force") => {
    setSigBusy(mode);
    try {
      const r = await api<any>(`/admin/signals/check${mode === "dry" ? "?dry=1" : mode === "force" ? "?force=1" : ""}`, { method: "POST" });
      if (r.seeded) toast.ok(`First evaluation: ${r.seeded} current signal(s) recorded as already known — only new or stronger ones will be announced from now on`);
      else if (mode === "dry") toast.ok(r.announced.length ? `Would announce: ${r.announced.map((x: any) => `${x.ticker} ${x.score}`).join(", ")}` : "Nothing new to announce");
      else toast.ok(r.announced.length ? `Announced ${r.announced.length}: ${r.announced.map((x: any) => `${x.ticker} (${x.sentTo} deliveries)`).join(", ")}` : "Nothing new to announce");
      load();
    } catch (e: any) { toast.err(e.message); } finally { setSigBusy(""); }
  };
  const resend = async (id: number) => {
    setBusy(id);
    try { const r = await api<any>(`/admin/alerts/resend/${id}`, { method: "POST" }); toast.ok(`Re-sent: ${Object.entries(r ?? {}).map(([k, v]) => `${k} ${v}`).join(" · ")}`); load(); } catch (e: any) { toast.err(e.message); } finally { setBusy(0); }
  };
  const testAll = async () => { try { const r = await api<any>("/admin/test/all", { method: "POST" }); toast.ok(Object.entries(r.results).map(([k, v]) => `${k}: ${v}`).join(" · ")); } catch (e: any) { toast.err(e.message); } };
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 basis-[260px]"><h2 className="font-display font-600">🚦 Signal alerts</h2><p className="text-sm text-slate-400">After every ingest that adds filings, new or strengthened buy signals (at or above the minimum confidence set in Data feed) go to your channels and to every Pro member who opted in. A ticker is re-announced only when its confidence rises or 2+ more lawmakers join.</p></div>
          <button className="btn-ghost text-sm" disabled={!!sigBusy} onClick={() => checkSignals("dry")}>Dry run</button>
          <button className="btn-ghost text-sm" disabled={!!sigBusy} onClick={() => checkSignals("run")}><RefreshCw size={14} className={sigBusy === "run" ? "animate-spin" : ""} /> Check now</button>
          <button className="btn-gold text-sm" disabled={!!sigBusy} onClick={() => { if (confirm("Force-announce the current top signals to everyone now?")) checkSignals("force"); }}>Announce now</button>
        </div>
        {sig.length > 0 && (
          <table className="mt-3 w-full text-sm"><thead className="border-b border-line"><tr><th className="th">When</th><th className="th">Ticker</th><th className="th">Confidence</th><th className="th text-right">Score</th><th className="th text-right">Buyers</th><th className="th text-right">Delivered</th></tr></thead>
            <tbody className="divide-y divide-line">{sig.slice(0, 12).map((r) => <tr key={r.id}><td className="td whitespace-nowrap text-slate-400">{r.created_at?.replace("T", " ").slice(5, 16)}</td><td className="td"><span className="flex items-center gap-1.5 font-mono font-700 text-gold"><IssuerLogo ticker={r.ticker} size={18} />{r.ticker}</span></td><td className="td capitalize">{r.confidence}</td><td className="td text-right font-mono">{r.score}</td><td className="td text-right font-mono">{r.buyers}</td><td className="td text-right font-mono">{r.sent ?? 0}/{r.attempts}</td></tr>)}</tbody></table>
        )}
      </div>
      <div className="flex items-center justify-between"><p className="text-sm text-slate-400">Trade alerts — every delivery attempt per channel. Failed rows show the provider's error so you can fix the key and re-send.</p><button className="btn-ghost text-sm" onClick={testAll}><Send size={14} /> Send test to all channels</button></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line"><tr><th className="th">When</th><th className="th">Trade</th><th className="th">Channel</th><th className="th">Result</th><th className="th text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-ink-700/40">
                <td className="td whitespace-nowrap text-slate-400">{a.created_at?.replace("T", " ").slice(0, 16)}</td>
                <td className="td"><span className={a.tx_type === "buy" ? "pill-buy" : a.tx_type === "sell" ? "pill-sell" : "pill-ex"}>{a.tx_type.toUpperCase()}</span> <span className="font-semibold">{a.politician}</span> <span className="inline-flex items-center gap-1.5 align-middle font-mono text-gold-300"><IssuerLogo ticker={a.ticker} size={18} />{a.ticker}</span></td>
                <td className="td capitalize">{a.channel}</td>
                <td className="td">{a.ok ? <span className="flex items-center gap-1 text-buy"><CheckCircle2 size={14} /> sent</span> : <span className="flex items-center gap-1 text-xs text-sell"><XCircle size={14} /> {a.info}</span>}</td>
                <td className="td text-right"><button className="btn-ghost px-2 py-1 text-xs" disabled={busy === a.trade_id} onClick={() => resend(a.trade_id)}><RefreshCw size={12} className={busy === a.trade_id ? "animate-spin" : ""} /> Re-send</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5}><Empty text="No alerts sent yet. They appear here as soon as a new trade is ingested." /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
