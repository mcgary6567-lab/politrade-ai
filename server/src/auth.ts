import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { get, run } from "./db.js";

export type AuthUser = { id: number; email: string; name?: string; role: string };
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

export function login(email: string, password: string): { token: string; user: AuthUser } | null {
  const row = get("SELECT * FROM users WHERE email=?", String(email).toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return null;
  if (row.status && row.status !== "active") return null;
  run("UPDATE users SET last_login=? WHERE id=?", new Date().toISOString(), row.id);
  const user: AuthUser = { id: row.id, email: row.email, name: row.name, role: row.role };
  return { token: signToken(user), user };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  try {
    const p = jwt.verify(token, config.jwtSecret) as any;
    // role/status come from the DB so admin changes apply immediately (and suspended users are cut off)
    const row = get("SELECT id,email,name,role,status FROM users WHERE id=?", p.uid);
    if (!row || (row.status && row.status !== "active")) return res.status(401).json({ error: "Account is not active" });
    req.user = { id: row.id, email: row.email, name: row.name, role: row.role };
    next();
  } catch { res.status(401).json({ error: "Please sign in" }); }
}
