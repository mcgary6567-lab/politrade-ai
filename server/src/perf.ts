import type { Request, Response, NextFunction } from "express";
import { gzipSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { PHOTO_URL } from "./sources.js";

/** Gzip JSON / text responses over 1 KB when the client accepts it (no extra dependency). */
export function compress(req: Request, res: Response, next: NextFunction) {
  if (!/\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""))) return next();
  const json = res.json.bind(res);
  res.json = (body: any) => {
    const txt = JSON.stringify(body);
    if (txt.length < 1024) return json(body);
    const gz = gzipSync(Buffer.from(txt), { level: 6 });
    res.setHeader("content-encoding", "gzip"); res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("vary", "accept-encoding"); res.setHeader("content-length", String(gz.length));
    return res.end(gz) as any;
  };
  next();
}

/** Small in-memory TTL cache for expensive read-only aggregates; cleared whenever new trades arrive. */
const store = new Map<string, { at: number; body: any }>();
let generation = 0;
export const bumpCache = () => { generation++; store.clear(); };
export function cached(ttlMs: number, keyFn?: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${generation}|${req.user?.pro ? "pro" : "free"}|${keyFn ? keyFn(req) : req.originalUrl}`;
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) { res.setHeader("x-cache", "hit"); return res.json(hit.body); }
    const json = res.json.bind(res);
    res.json = (body: any) => { if (res.statusCode === 200) store.set(key, { at: Date.now(), body }); return json(body); };
    next();
  };
}

/** Politician photos proxied through our own origin and cached on disk, so the browser never hits GitHub 350 times. */
const photoDir = path.join(path.dirname(config.dbPath), "photos");
fs.mkdirSync(photoDir, { recursive: true });
const inflight = new Map<string, Promise<Buffer | null>>();
export async function photo(req: Request, res: Response) {
  const id = String(req.params.bioguide).replace(/[^A-Za-z0-9]/g, "");
  if (!id) return res.status(404).end();
  const file = path.join(photoDir, `${id}.jpg`);
  res.setHeader("cache-control", "public, max-age=2592000, immutable");
  if (fs.existsSync(file)) return res.type("jpeg").send(fs.readFileSync(file));
  let p = inflight.get(id);
  if (!p) {
    p = fetch(PHOTO_URL(id)).then(async (r) => (r.ok ? Buffer.from(await r.arrayBuffer()) : null)).catch(() => null);
    inflight.set(id, p); p.finally(() => inflight.delete(id));
  }
  const buf = await p;
  if (!buf) { res.setHeader("cache-control", "public, max-age=86400"); return res.status(404).end(); }
  fs.writeFile(file, buf, () => {});
  res.type("jpeg").send(buf);
}

/** Company logos by ticker, proxied through our own origin and cached on disk (keyless source, PNG). */
const logoDir = path.join(path.dirname(config.dbPath), "logos");
fs.mkdirSync(logoDir, { recursive: true });
const logoInflight = new Map<string, Promise<Buffer | null>>();
// keyless ticker-logo CDNs, tried in order; whichever first returns a real image wins
const LOGO_SOURCES = [
  (t: string) => `https://assets.parqet.com/logos/symbol/${t}?format=png`,
  (t: string) => `https://financialmodelingprep.com/image-stock/${t}.png`,
];
async function fetchLogo(ticker: string): Promise<Buffer | null> {
  for (const src of LOGO_SOURCES) {
    try {
      const r = await fetch(src(ticker));
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length >= 100) return buf; // a real image, not an empty/placeholder body
    } catch { /* try the next source */ }
  }
  return null;
}
export async function logo(req: Request, res: Response) {
  const t = String(req.params.ticker).toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (!t) return res.status(404).end();
  const file = path.join(logoDir, `${t}.png`);
  res.setHeader("cache-control", "public, max-age=2592000, immutable");
  if (fs.existsSync(file)) {
    const buf = fs.readFileSync(file);
    if (!buf.length) { res.setHeader("cache-control", "public, max-age=86400"); return res.status(404).end(); } // cached miss
    return res.type("png").send(buf);
  }
  let p = logoInflight.get(t);
  if (!p) { p = fetchLogo(t); logoInflight.set(t, p); p.finally(() => logoInflight.delete(t)); }
  const buf = await p;
  if (!buf) { fs.writeFile(file, Buffer.alloc(0), () => {}); res.setHeader("cache-control", "public, max-age=86400"); return res.status(404).end(); } // remember the miss for a day
  fs.writeFile(file, buf, () => {});
  res.type("png").send(buf);
}
