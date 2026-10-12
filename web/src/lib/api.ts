const KEY = "pt_token";
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t: string | null) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

/** GET responses are kept for a short while so moving between pages does not re-download the same data. */
const memo = new Map<string, { at: number; p: Promise<any> }>();
const TTL = 60_000;
export const invalidate = (prefix = "") => { for (const k of [...memo.keys()]) if (k.startsWith(prefix)) memo.delete(k); };
export function prefetch(path: string) { api(path).catch(() => {}); }

export async function api<T = any>(path: string, opts: { method?: string; body?: any; fresh?: boolean } = {}): Promise<T> {
  const method = opts.method ?? (opts.body ? "POST" : "GET");
  if (method === "GET" && !opts.fresh) {
    const hit = memo.get(path);
    if (hit && Date.now() - hit.at < TTL) return hit.p;
    const p = request<T>(path, opts).catch((e) => { memo.delete(path); throw e; });
    memo.set(path, { at: Date.now(), p });
    return p;
  }
  const r = await request<T>(path, opts);
  if (method !== "GET") invalidate();   // a write may change any list
  return r;
}

async function request<T>(path: string, opts: { method?: string; body?: any }): Promise<T> {
  const res = await fetch("/api" + path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e: any = new Error(res.status === 503 && !navigator.onLine ? "You are offline — this page was not loaded before." : (data?.error || `Error ${res.status}`)); e.status = res.status; throw e; }
  return data as T;
}

export const money = (min?: number | null, max?: number | null) => {
  if (min == null) return "—";
  const f = (n: number) => "$" + n.toLocaleString("en-US");
  return max && max !== min ? `${f(min)}–${f(max)}` : f(min);
};
export const ago = (d?: string | null) => {
  if (!d) return "—";
  const days = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
