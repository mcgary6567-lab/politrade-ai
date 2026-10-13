import { useEffect, useState } from "react";
import { Smartphone, Apple, Monitor, Download, Share, MoreVertical, PlusSquare, WifiOff, X } from "lucide-react";

/** The browser's install prompt (Chrome / Edge / Android) is captured once so any button can trigger it. */
let deferred: any = null;
const subs = new Set<(v: boolean) => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => { e.preventDefault(); deferred = e; subs.forEach((f) => f(true)); });
  window.addEventListener("appinstalled", () => { deferred = null; subs.forEach((f) => f(false)); });
}
export const isStandalone = () => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isAndroid = () => /android/i.test(navigator.userAgent);

export function useInstall() {
  const [canPrompt, setCanPrompt] = useState(Boolean(deferred));
  useEffect(() => { subs.add(setCanPrompt); return () => { subs.delete(setCanPrompt); }; }, []);
  const prompt = async () => { if (!deferred) return false; deferred.prompt(); const r = await deferred.userChoice; if (r.outcome === "accepted") deferred = null; return r.outcome === "accepted"; };
  return { canPrompt, prompt, installed: isStandalone() };
}

/** Footer block: Android / iPhone / Desktop buttons that install directly when possible, or open step-by-step instructions. */
export default function InstallApp() {
  const { canPrompt, prompt, installed } = useInstall();
  const [guide, setGuide] = useState<"android" | "ios" | "desktop" | null>(null);
  const click = async (kind: "android" | "ios" | "desktop") => {
    if (kind !== "ios" && canPrompt && (await prompt())) return;
    setGuide(kind);
  };
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Get the app</h4>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => click("android")} className="btn-ghost gap-2 px-3 py-2 text-sm"><Smartphone size={16} className="text-buy" /> Android</button>
        <button onClick={() => click("ios")} className="btn-ghost gap-2 px-3 py-2 text-sm"><Apple size={16} /> iPhone</button>
        <button onClick={() => click("desktop")} className="btn-ghost gap-2 px-3 py-2 text-sm"><Monitor size={16} className="text-gold" /> Desktop</button>
      </div>
      {installed && <p className="mt-2 text-xs text-buy">✓ Installed — you are using the app.</p>}
      {guide && <Guide kind={guide} canPrompt={canPrompt} onPrompt={prompt} onClose={() => setGuide(null)} />}
    </div>
  );
}

function Guide({ kind, canPrompt, onPrompt, onClose }: { kind: "android" | "ios" | "desktop"; canPrompt: boolean; onPrompt: () => Promise<boolean>; onClose: () => void }) {
  const url = window.location.origin;
  const steps = kind === "ios" ? [
    ["Open this site in Safari", `${url} — Chrome on iPhone cannot install apps.`, <Apple size={18} />],
    ["Tap the Share button", "The square with an arrow at the bottom of Safari.", <Share size={18} />],
    ["Tap “Add to Home Screen”", "Scroll the list a little if you don't see it, then tap Add.", <PlusSquare size={18} />],
    ["Done", "Hillradar AI appears on your home screen and opens full-screen.", <Download size={18} />],
  ] : kind === "android" ? [
    ["Open this site in Chrome", url, <Smartphone size={18} />],
    ["Tap the ⋮ menu (top right)", "Or wait for the “Add Hillradar AI to Home screen” bar at the bottom.", <MoreVertical size={18} />],
    ["Tap “Install app” / “Add to Home screen”", "Then tap Install.", <Download size={18} />],
    ["Done", "The app icon is on your home screen and in the app drawer.", <PlusSquare size={18} />],
  ] : [
    ["Open this site in Chrome or Edge", url, <Monitor size={18} />],
    ["Click the install icon in the address bar", "A small monitor-with-arrow icon at the right end of the address bar — or menu ⋮ → “Install Hillradar AI”.", <Download size={18} />],
    ["Click Install", "It opens in its own window and gets a Start-menu / Dock icon.", <PlusSquare size={18} />],
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-700">Install on {kind === "ios" ? "iPhone / iPad" : kind === "android" ? "Android" : "Desktop"}</h3>
          <button className="btn-ghost px-2 py-1.5" onClick={onClose}><X size={16} /></button>
        </div>
        {canPrompt && kind !== "ios" && <button className="btn-gold mb-4 w-full" onClick={async () => { if (await onPrompt()) onClose(); }}><Download size={16} /> Install now</button>}
        <ol className="space-y-3">
          {steps.map(([t, d, icon], i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-600 text-gold">{icon as any}</span>
              <div><div className="text-sm font-semibold">{i + 1}. {t as string}</div><div className="text-xs text-slate-400">{d as string}</div></div>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500"><WifiOff size={14} className="mt-0.5 shrink-0" /> Once installed, the app opens even without internet and shows the trades, politicians and dashboard you loaded last; new filings sync when you are back online.</p>
      </div>
    </div>
  );
}

/** Thin bar at the top while offline, so people know they are looking at saved data. */
export function OfflineBar() {
  const [off, setOff] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  useEffect(() => { const on = () => setOff(false), offf = () => setOff(true); window.addEventListener("online", on); window.addEventListener("offline", offf); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", offf); }; }, []);
  if (!off) return null;
  return <div className="flex items-center justify-center gap-2 bg-gold px-3 py-1.5 text-center text-xs font-semibold text-ink-900"><WifiOff size={14} /> You are offline — showing the last data loaded. New filings will sync when you reconnect.</div>;
}

/** Small install banner shown once on phones when the browser can install directly. */
export function InstallNudge() {
  const { canPrompt, prompt, installed } = useInstall();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("pt_nudge") === "1"; } catch { return false; } });
  if (installed || hidden || !(canPrompt || isIOS()) || !(isAndroid() || isIOS())) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem("pt_nudge", "1"); } catch { /* ignore */ } };
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-2xl border border-gold/40 bg-ink-700/95 p-3 shadow-xl backdrop-blur md:hidden">
      <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm"><b>Install Hillradar AI</b><div className="text-xs text-slate-400">Opens like an app · works offline</div></div>
      {canPrompt ? <button className="btn-gold px-3 py-1.5 text-xs" onClick={async () => { if (await prompt()) dismiss(); }}>Install</button>
        : <a href="#install" className="btn-gold px-3 py-1.5 text-xs" onClick={dismiss}>How</a>}
      <button className="btn-ghost px-2 py-1.5" onClick={dismiss}><X size={14} /></button>
    </div>
  );
}
