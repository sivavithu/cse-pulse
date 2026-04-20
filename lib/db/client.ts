import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;
let _initialized = false;

export function getDb(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  _client = createClient({ url, authToken });
  return _client;
}

export async function ensureSchema(): Promise<void> {
  if (_initialized) return;
  const db = getDb();
  const tables = [
    `CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS user_settings (
      user_email TEXT NOT NULL,
      key        TEXT NOT NULL,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_email, key)
    )`,
    `CREATE TABLE IF NOT EXISTS holdings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email   TEXT NOT NULL,
      symbol       TEXT NOT NULL,
      company_name TEXT,
      qty          REAL NOT NULL,
      avg_price    REAL NOT NULL,
      notes        TEXT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS watchlist (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email         TEXT NOT NULL,
      symbol             TEXT NOT NULL,
      company_name       TEXT,
      alert_above        REAL,
      alert_below        REAL,
      announcement_alert INTEGER NOT NULL DEFAULT 0,
      created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE (user_email, symbol)
    )`,
    `CREATE TABLE IF NOT EXISTS snapshots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email  TEXT NOT NULL,
      taken_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      total_value REAL NOT NULL,
      cash        REAL NOT NULL DEFAULT 0,
      pl          REAL NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS fallback_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint      TEXT NOT NULL,
      used_fallback INTEGER NOT NULL DEFAULT 0,
      at            INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS alert_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      symbol     TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      threshold  REAL NOT NULL,
      price      REAL NOT NULL,
      fired_at   INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
  ];
  await db.batch(tables.map((sql) => ({ sql, args: [] })), "write");
  _initialized = true;
}
