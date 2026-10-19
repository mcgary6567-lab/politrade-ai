import { useEffect, useMemo, useState } from "react";

/**
 * Light / dark theme. The palette lives in CSS variables (index.css); Tailwind colours read them,
 * so flipping `data-theme` on <html> re-skins the whole app. The preference is stored in
 * localStorage ("hr-theme": light | dark); when nothing is stored we follow the OS setting.
 * index.html applies the theme inline before first paint so there is no flash.
 */
export type Theme = "light" | "dark";
export type Preference = Theme | "system";
export const THEME_KEY = "hr-theme";

const listeners = new Set<() => void>();
const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null;

function systemTheme(): Theme { return mq?.matches ? "light" : "dark"; }
function stored(): Theme | null {
  try { const v = localStorage.getItem(THEME_KEY); return v === "light" || v === "dark" ? v : null; } catch { return null; }
}

export function getTheme(): Theme { return document.documentElement.dataset.theme === "light" ? "light" : "dark"; }
export function getPreference(): Preference { return stored() ?? "system"; }

function paint(t: Theme) {
  const html = document.documentElement;
  html.dataset.theme = t;
  html.classList.toggle("dark", t === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#f4f6fb" : "#0a0f1c");
  listeners.forEach((f) => f());
}

/** Save a preference and apply it. "system" clears the stored value and follows the OS. */
export function setPreference(p: Preference) {
  try { if (p === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, p); } catch { /* private mode */ }
  paint(p === "system" ? systemTheme() : p);
}
export function toggleTheme() { setPreference(getTheme() === "dark" ? "light" : "dark"); }

// follow OS changes while no explicit preference is stored
mq?.addEventListener?.("change", () => { if (!stored()) paint(systemTheme()); });

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (typeof document === "undefined" ? "dark" : getTheme()));
  const [pref, setPref] = useState<Preference>(getPreference);
  useEffect(() => {
    const f = () => { setTheme(getTheme()); setPref(getPreference()); };
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return { theme, pref, toggle: toggleTheme, set: setPreference };
}

/** Chart colours for the current theme (Recharts needs real colour strings, not CSS vars). */
export function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (k: string, fb: string) => css.getPropertyValue(k).trim() || fb;
    const c = {
      tick: v("--c-tick", "#8a96ad"), grid: v("--c-grid", "#223052"), text: v("--c-text", "#e7ecf5"), muted: v("--c-tick", "#8a96ad"),
      tipBg: v("--c-tip-bg", "#121a2e"), gold: v("--c-gold", "#e7b23c"), buy: v("--c-buy", "#22c58b"), sell: v("--c-sell", "#f26a6a"),
    };
    const tip = { contentStyle: { background: c.tipBg, border: `1px solid ${c.grid}`, borderRadius: 10, color: c.text, fontSize: 12 }, cursor: { fill: "rgba(231,178,60,.08)" } } as any;
    return { ...c, tip, theme };
  }, [theme]);
}
