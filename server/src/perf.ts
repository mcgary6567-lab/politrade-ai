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
