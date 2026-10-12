import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

/** Add a column if it is missing (idempotent migration). */
function addColumn(table: string, col: string, type: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!cols.some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      name TEXT, role TEXT NOT NULL DEFAULT 'member', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS politicians (
      id INTEGER PRIMARY KEY, ext_id TEXT UNIQUE, name TEXT NOT NULL,
      party TEXT, chamber TEXT, state TEXT, photo_url TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS issuers (
      id INTEGER PRIMARY KEY, ticker TEXT, name TEXT NOT NULL, sector TEXT,
      created_at TEXT NOT NULL, UNIQUE(ticker, name)
    );
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY, raw_id TEXT UNIQUE,
      politician_id INTEGER NOT NULL REFERENCES politicians(id),
      issuer_id INTEGER NOT NULL REFERENCES issuers(id),
      tx_type TEXT NOT NULL,            -- buy | sell | exchange
      tx_date TEXT, published_date TEXT,
      amount_min INTEGER, amount_max INTEGER,
      filed_after_days INTEGER, owner TEXT, comment TEXT,
      ai_note TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_trades_pub ON trades(published_date DESC);
    CREATE INDEX IF NOT EXISTS idx_trades_pol ON trades(politician_id);
    CREATE INDEX IF NOT EXISTS idx_trades_iss ON trades(issuer_id);
    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL,               -- politician | ticker | party | any
      value TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS alerts_sent (
      id INTEGER PRIMARY KEY, trade_id INTEGER NOT NULL REFERENCES trades(id),
      channel TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 1, info TEXT, created_at TEXT NOT NULL,
      UNIQUE(trade_id, channel)
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  `);
}

export const get = (sql: string, ...p: any[]) => db.prepare(sql).get(...p) as any;
export const all = (sql: string, ...p: any[]) => db.prepare(sql).all(...p) as any[];
export const run = (sql: string, ...p: any[]) => db.prepare(sql).run(...p);

export const getSetting = (k: string): string | null => (get("SELECT value FROM settings WHERE key=?", k)?.value ?? null);
export const setSetting = (k: string, v: string) => run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", k, v);
