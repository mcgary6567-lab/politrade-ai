import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { get, run } from "./db.js";

export type AuthUser = { id: number; email: string; name?: string; role: string; plan?: string; pro?: boolean };

/** Plan name for a user row; a paid plan (price > 0, active) or admin role unlocks Pro features. */
export function planOf(row: { id: number; role: string; plan_id?: number | null }): { plan: string; pro: boolean } {
  const p = row.plan_id ? get("SELECT name, price_cents, active FROM plans WHERE id=?", row.plan_id) : null;
  const plan = p?.name ?? "Free";
  return { plan, pro: row.role === "admin" || Boolean(p && p.active && p.price_cents > 0) };
}
declare global { namespace Express { interface Request { user?: AuthUser } } }

export function seedAdmin() {
  const email = config.adminEmail;
  const existing = get("SELECT id FROM users WHERE email=?", email);
  const hash = bcrypt.hashSync(config.adminPassword, 10);
  if (existing) run("UPDATE users SET password_hash=? WHERE id=?", hash, existing.id);
  else run("INSERT INTO users(email,password_hash,name,role,created_at) VALUES(?,?,?,?,?)",
    email, hash, "Admin", "admin", new Date().toISOString());
}

export function signToken(u: AuthUser): string {
  return jwt.sign({ uid: u.id, email: u.email, role: u.role, name: u.name }, config.jwtSecret, { expiresIn: "30d" });
}

function finishLogin(row: any) {
  run("UPDATE users SET last_login=?, pin_fails=0 WHERE id=?", new Date().toISOString(), row.id);
  const user: AuthUser = { id: row.id, email: row.email, name: row.name, role: row.role, ...planOf(row) };
  return { token: signToken(user), user };
}

export function login(email: string, password: string): { token: string; user: AuthUser } | null {
  const row = get("SELECT * FROM users WHERE email=?", String(email).toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return null;
  if (row.status && row.status !== "active") return null;
  return finishLogin(row);
}

const PIN_MAX_FAILS = 5, PIN_LOCK_MIN = 15;
/** Sign in with email + 4-digit PIN. Locked for 15 minutes after 5 wrong PINs (a 4-digit code needs brute-force protection). */
export function loginWithPin(email: string, pin: string): { token: string; user: AuthUser } | { error: string } {
  const row = get("SELECT * FROM users WHERE email=?", String(email).toLowerCase());
  if (!row || !row.pin_hash) return { error: "No PIN is set for this account — sign in with your password and set one in Settings" };
  if (row.status && row.status !== "active") return { error: "Account is not active" };
  if (row.pin_locked_until && row.pin_locked_until > new Date().toISOString()) return { error: `Too many wrong PINs — try again in ${PIN_LOCK_MIN} minutes or use your password` };
  if (!/^\d{4}$/.test(pin) || !bcrypt.compareSync(pin, row.pin_hash)) {
    const fails = (row.pin_fails ?? 0) + 1;
    const lock = fails >= PIN_MAX_FAILS ? new Date(Date.now() + PIN_LOCK_MIN * 60000).toISOString() : null;
    run("UPDATE users SET pin_fails=?, pin_locked_until=? WHERE id=?", lock ? 0 : fails, lock, row.id);
    return { error: lock ? `Too many wrong PINs — locked for ${PIN_LOCK_MIN} minutes` : `Wrong PIN (${PIN_MAX_FAILS - fails} attempts left)` };
  }
  return finishLogin(row);
}

/** Public sign-up: creates a Free member. */
export function signup(d: { first_name: string; last_name: string; email: string; password: string }): { token: string; user: AuthUser } | { error: string } {
  const email = d.email.toLowerCase().trim();
  if (get("SELECT 1 FROM users WHERE email=?", email)) return { error: "An account with this email already exists — sign in instead" };
  const name = `${d.first_name.trim()} ${d.last_name.trim()}`.trim();
  const id = Number(run("INSERT INTO users(email,password_hash,name,first_name,last_name,role,status,created_at) VALUES(?,?,?,?,?,'member','active',?)",
    email, bcrypt.hashSync(d.password, 10), name, d.first_name.trim(), d.last_name.trim(), new Date().toISOString()).lastInsertRowid);
  return finishLogin(get("SELECT * FROM users WHERE id=?", id));
}

export const hashPin = (pin: string) => bcrypt.hashSync(pin, 10);

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  try {
    const p = jwt.verify(token, config.jwtSecret) as any;
    // role/status come from the DB so admin changes apply immediately (and suspended users are cut off)
    const row = get("SELECT id,email,name,role,status,plan_id FROM users WHERE id=?", p.uid);
    if (!row || (row.status && row.status !== "active")) return res.status(401).json({ error: "Account is not active" });
    req.user = { id: row.id, email: row.email, name: row.name, role: row.role, ...planOf(row) };
    next();
  } catch { res.status(401).json({ error: "Please sign in" }); }
}
