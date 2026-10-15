import { useEffect, useState, type ReactNode } from "react";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";

/** Small select used by every filter bar. */
export function Select({ value, onChange, opts, className = "" }: { value: string; onChange: (v: string) => void; opts: [string, string][]; className?: string }) {
  return (
    <select className={`input w-auto cursor-pointer ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {opts.map(([v, l]) => <option key={v} value={v} className="bg-ink-800">{l}</option>)}
    </select>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`card w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto p-5`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-700">{title}</h3><button className="btn-ghost px-2 py-1.5" onClick={onClose}><X size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}

/** Tiny toast store — call toast.ok / toast.err anywhere, render <Toasts/> once in the layout. */
type T = { id: number; kind: "ok" | "err"; text: string };
const subs = new Set<(t: T[]) => void>();
let list: T[] = [];
const push = (kind: T["kind"], text: string) => {
  const t = { id: Date.now() + Math.random(), kind, text };
  list = [...list, t]; subs.forEach((f) => f(list));
  setTimeout(() => { list = list.filter((x) => x.id !== t.id); subs.forEach((f) => f(list)); }, kind === "ok" ? 3500 : 6000);
};
export const toast = { ok: (t: string) => push("ok", t), err: (t: string) => push("err", t) };

export function Toasts() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => { subs.add(setItems); return () => { subs.delete(setItems); }; }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm shadow-lg backdrop-blur ${t.kind === "ok" ? "border-buy/40 bg-ink-700/95 text-buy" : "border-sell/40 bg-ink-700/95 text-sell"}`}>
          {t.kind === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <span className="text-slate-100">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function KPI({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: string; sub?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1.5 font-display text-2xl font-700 ${tone ?? ""}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-500">{text}</p>;
}

export const partyTone = (p?: string) => p === "Democrat" ? "text-sky-400" : p === "Republican" ? "text-rose-400" : "text-violet-300";
export const compact = (n?: number | null) => n == null ? "—" : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`;
export const pill = (t: string) => (t === "buy" ? "pill-buy" : t === "sell" ? "pill-sell" : "pill-ex");
export const AMOUNT_BANDS: [string, string, string][] = [
  ["", "", "Any amount"], ["1001", "15000", "$1K – $15K"], ["15001", "50000", "$15K – $50K"], ["50001", "100000", "$50K – $100K"],
  ["100001", "250000", "$100K – $250K"], ["250001", "1000000", "$250K – $1M"], ["1000001", "", "$1M+"],
];
