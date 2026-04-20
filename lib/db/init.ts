import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { USER_SETTING_KEYS } from "./setting-keys";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.CSE_PULSE_DB_PATH || path.join(DB_DIR, "cse-pulse.db");

// Existing single-tenant rows are migrated to this owner on first boot.
const LEGACY_OWNER = "vithus1912@gmail.com";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  migrateSchema(db);
  return db;
}

function hasColumn(d: Database.Database, table: string, col: string): boolean {
  const rows = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === col);
}

function tableExists(d: Database.Database, table: string): boolean {
  const row = d.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(table);
  return !!row;
}

function migrateSchema(d: Database.Database) {
  // Legacy per-column migrations (pre multi-tenant, idempotent)
  const legacyCols: string[] = [
    "ALTER TABLE watchlist ADD COLUMN listing_rights TEXT",
    "ALTER TABLE watchlist ADD COLUMN dividend REAL",
    "ALTER TABLE watchlist ADD COLUMN announcement_alert INTEGER NOT NULL DEFAULT 0",
  ];
  for (const sql of legacyCols) {
    try { d.exec(sql); } catch { /* column already exists */ }
  }

  migrateUserSettings(d);

  // Multi-tenant migration: add user_email to every user-scoped table.
  if (tableExists(d, "holdings") && !hasColumn(d, "holdings", "user_email")) {
    runMultiTenantMigration(d);
  }
}

function migrateUserSettings(d: Database.Database) {
  const placeholders = USER_SETTING_KEYS.map(() => "?").join(",");
  d.prepare(
    `INSERT OR IGNORE INTO user_settings (user_email, key, value, updated_at)
     SELECT ?, key, value, updated_at FROM settings WHERE key IN (${placeholders})`
  ).run(LEGACY_OWNER, ...USER_SETTING_KEYS);
  d.prepare(
    `DELETE FROM settings WHERE key IN (${placeholders})`
  ).run(...USER_SETTING_KEYS);
}

function runMultiTenantMigration(d: Database.Database) {
  const txn = d.transaction(() => {
    // watchlist: rebuild with user_email + composite UNIQUE
    d.exec(`
      CREATE TABLE watchlist_new (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email         TEXT NOT NULL,
        symbol             TEXT NOT NULL,
        company_name       TEXT,
        alert_above        REAL,
        alert_below        REAL,
        listing_rights     TEXT,
        dividend           REAL,
        announcement_alert INTEGER NOT NULL DEFAULT 0,
        created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE (user_email, symbol)
      );
      INSERT INTO watchlist_new
        (id, user_email, symbol, company_name, alert_above, alert_below,
         listing_rights, dividend, announcement_alert, created_at)
      SELECT id, '${LEGACY_OWNER}', symbol, company_name, alert_above, alert_below,
             listing_rights, dividend, announcement_alert, created_at
      FROM watchlist;
      DROP TABLE watchlist;
      ALTER TABLE watchlist_new RENAME TO watchlist;
    `);

    // holdings / snapshots / alert_log: add user_email column
    d.exec(`ALTER TABLE holdings   ADD COLUMN user_email TEXT NOT NULL DEFAULT '${LEGACY_OWNER}'`);
    d.exec(`ALTER TABLE snapshots  ADD COLUMN user_email TEXT NOT NULL DEFAULT '${LEGACY_OWNER}'`);
    d.exec(`ALTER TABLE alert_log  ADD COLUMN user_email TEXT NOT NULL DEFAULT '${LEGACY_OWNER}'`);

    migrateUserSettings(d);
  });
  txn();
}

function initSchema(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_email TEXT NOT NULL,
      key        TEXT NOT NULL,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_email, key)
    );

    CREATE TABLE IF NOT EXISTS holdings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email   TEXT NOT NULL,
      symbol       TEXT NOT NULL,
      company_name TEXT,
      qty          REAL NOT NULL,
      avg_price    REAL NOT NULL,
      notes        TEXT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email         TEXT NOT NULL,
      symbol             TEXT NOT NULL,
      company_name       TEXT,
      alert_above        REAL,
      alert_below        REAL,
      listing_rights     TEXT,
      dividend           REAL,
      announcement_alert INTEGER NOT NULL DEFAULT 0,
      created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE (user_email, symbol)
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email  TEXT NOT NULL,
      taken_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      total_value REAL NOT NULL,
      cash        REAL NOT NULL DEFAULT 0,
      pl          REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fallback_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint      TEXT NOT NULL,
      used_fallback INTEGER NOT NULL DEFAULT 0,
      at            INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS alert_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      symbol     TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      threshold  REAL NOT NULL,
      price      REAL NOT NULL,
      fired_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}
