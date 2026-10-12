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
    CREATE INDEX IF NOT EXISTS idx_trades_type ON trades(tx_type);
    CREATE INDEX IF NOT EXISTS idx_trades_txd ON trades(tx_date);
    CREATE INDEX IF NOT EXISTS idx_trades_amt ON trades(amount_max);
    CREATE INDEX IF NOT EXISTS idx_pol_party ON politicians(party, chamber, state);
    CREATE INDEX IF NOT EXISTS idx_iss_ticker ON issuers(ticker);
    CREATE INDEX IF NOT EXISTS idx_iss_sector ON issuers(sector);
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
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, price_cents INTEGER NOT NULL DEFAULT 0,
      interval TEXT NOT NULL DEFAULT 'month', features TEXT, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ingest_log (
      id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, fetched INTEGER, added INTEGER, error TEXT, source TEXT
    );
  `);
  addColumn("users", "plan_id", "INTEGER");
  addColumn("users", "status", "TEXT NOT NULL DEFAULT 'active'");
  addColumn("users", "last_login", "TEXT");
  addColumn("trades", "ret_6m", "REAL");
  addColumn("trades", "excess_6m", "REAL");
  addColumn("politicians", "hit_rate", "REAL");
  addColumn("politicians", "avg_excess", "REAL");
  addColumn("politicians", "ann_return", "REAL");
  addColumn("politicians", "spy_return", "REAL");
  addColumn("politicians", "sharpe", "REAL");
  addColumn("politicians", "perf_n", "INTEGER");
  // rows imported before filing delay was derived from the dates
  db.exec("UPDATE trades SET filed_after_days = CAST(MAX(0, julianday(published_date) - julianday(tx_date)) AS INTEGER) WHERE filed_after_days IS NULL AND tx_date IS NOT NULL AND published_date IS NOT NULL");
  addColumn("users", "tg_chat_id", "TEXT");
  addColumn("users", "wa_to", "TEXT");
  addColumn("users", "alert_email", "TEXT");
  addColumn("users", "notify", "INTEGER NOT NULL DEFAULT 1");
  addColumn("users", "notify_signals", "INTEGER NOT NULL DEFAULT 1");
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_alerts (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), trade_id INTEGER NOT NULL REFERENCES trades(id),
      channel TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 1, info TEXT, created_at TEXT NOT NULL, UNIQUE(user_id, trade_id, channel)
    );
    CREATE TABLE IF NOT EXISTS tg_links (code TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS signal_alerts (
      id INTEGER PRIMARY KEY, ticker TEXT NOT NULL, direction TEXT NOT NULL, confidence TEXT NOT NULL, score INTEGER NOT NULL,
      buyers INTEGER NOT NULL, sellers INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sig_alerts ON signal_alerts(ticker, direction, created_at);
    CREATE TABLE IF NOT EXISTS user_signal_alerts (
      id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), signal_id INTEGER NOT NULL REFERENCES signal_alerts(id),
      channel TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 1, info TEXT, created_at TEXT NOT NULL
    );
  `);
}

export const get = (sql: string, ...p: any[]) => db.prepare(sql).get(...p) as any;
export const all = (sql: string, ...p: any[]) => db.prepare(sql).all(...p) as any[];
export const run = (sql: string, ...p: any[]) => db.prepare(sql).run(...p);

export const getSetting = (k: string): string | null => (get("SELECT value FROM settings WHERE key=?", k)?.value ?? null);
export const setSetting = (k: string, v: string) => run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", k, v);
