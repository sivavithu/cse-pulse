import { getDb, ensureSchema } from "./client";
import type { InValue } from "@libsql/client";

async function db() {
  await ensureSchema();
  return getDb();
}

// ── Global settings ───────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
  return (r.rows[0]?.value as string) ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch())
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
    args: [key, value],
  });
}

export async function setSettings(pairs: Record<string, string>): Promise<void> {
  if (!Object.keys(pairs).length) return;
  const c = await db();
  await c.batch(
    Object.entries(pairs).map(([k, v]) => ({
      sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch())
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
      args: [k, v] as InValue[],
    })),
    "write"
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const c = await db();
  const r = await c.execute("SELECT key, value FROM settings");
  return Object.fromEntries(r.rows.map((row) => [row.key as string, row.value as string]));
}

// ── Per-user settings ─────────────────────────────────────────────────────────

export async function getUserSetting(userEmail: string, key: string): Promise<string | null> {
  const c = await db();
  const r = await c.execute({
    sql: "SELECT value FROM user_settings WHERE user_email = ? AND key = ?",
    args: [userEmail, key],
  });
  return (r.rows[0]?.value as string) ?? null;
}

export async function setUserSetting(userEmail: string, key: string, value: string): Promise<void> {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO user_settings (user_email, key, value, updated_at)
          VALUES (?, ?, ?, unixepoch())
          ON CONFLICT(user_email, key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
    args: [userEmail, key, value],
  });
}

export async function setUserSettings(userEmail: string, pairs: Record<string, string>): Promise<void> {
  if (!Object.keys(pairs).length) return;
  const c = await db();
  await c.batch(
    Object.entries(pairs).map(([k, v]) => ({
      sql: `INSERT INTO user_settings (user_email, key, value, updated_at)
            VALUES (?, ?, ?, unixepoch())
            ON CONFLICT(user_email, key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
      args: [userEmail, k, v] as InValue[],
    })),
    "write"
  );
}

export async function getAllUserSettings(userEmail: string): Promise<Record<string, string>> {
  const c = await db();
  const r = await c.execute({
    sql: "SELECT key, value FROM user_settings WHERE user_email = ?",
    args: [userEmail],
  });
  return Object.fromEntries(r.rows.map((row) => [row.key as string, row.value as string]));
}

// ── Holdings ──────────────────────────────────────────────────────────────────

export interface Holding {
  id: number;
  user_email: string;
  symbol: string;
  company_name: string | null;
  qty: number;
  avg_price: number;
  notes: string | null;
  created_at: number;
}

export async function getHoldings(userEmail: string): Promise<Holding[]> {
  const c = await db();
  const r = await c.execute({
    sql: "SELECT * FROM holdings WHERE user_email = ? ORDER BY symbol",
    args: [userEmail],
  });
  return r.rows as unknown as Holding[];
}

export async function addHolding(
  userEmail: string,
  h: Omit<Holding, "id" | "user_email" | "created_at">
): Promise<Holding> {
  const c = await db();
  const r = await c.execute({
    sql: "INSERT INTO holdings (user_email, symbol, company_name, qty, avg_price, notes) VALUES (?, ?, ?, ?, ?, ?)",
    args: [userEmail, h.symbol.toUpperCase(), h.company_name ?? null, h.qty, h.avg_price, h.notes ?? null],
  });
  const row = await c.execute({ sql: "SELECT * FROM holdings WHERE id = ?", args: [r.lastInsertRowid!] });
  return row.rows[0] as unknown as Holding;
}

export async function updateHolding(
  userEmail: string,
  id: number,
  h: Partial<Omit<Holding, "id" | "user_email" | "created_at">>
): Promise<void> {
  const fields = Object.keys(h);
  if (!fields.length) return;
  const c = await db();
  await c.execute({
    sql: `UPDATE holdings SET ${fields.map((f) => `${f} = ?`).join(", ")} WHERE id = ? AND user_email = ?`,
    args: [...fields.map((f) => (h as Record<string, unknown>)[f] as InValue), id, userEmail],
  });
}

export async function deleteHolding(userEmail: string, id: number): Promise<void> {
  const c = await db();
  await c.execute({ sql: "DELETE FROM holdings WHERE id = ? AND user_email = ?", args: [id, userEmail] });
}

// ── Watchlist ─────────────────────────────────────────────────────────────────

export interface WatchlistItem {
  id: number;
  user_email: string;
  symbol: string;
  company_name: string | null;
  alert_above: number | null;
  alert_below: number | null;
  announcement_alert: number;
  created_at: number;
}

export async function getWatchlist(userEmail: string): Promise<WatchlistItem[]> {
  const c = await db();
  const r = await c.execute({
    sql: "SELECT * FROM watchlist WHERE user_email = ? ORDER BY symbol",
    args: [userEmail],
  });
  return r.rows as unknown as WatchlistItem[];
}

export async function addToWatchlist(
  userEmail: string,
  item: Omit<WatchlistItem, "id" | "user_email" | "created_at">
): Promise<void> {
  const c = await db();
  await c.execute({
    sql: `INSERT OR IGNORE INTO watchlist
          (user_email, symbol, company_name, alert_above, alert_below, announcement_alert)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      userEmail,
      item.symbol.toUpperCase(),
      item.company_name ?? null,
      item.alert_above ?? null,
      item.alert_below ?? null,
      item.announcement_alert ?? 0,
    ],
  });
}

export async function updateWatchlistItem(
  userEmail: string,
  id: number,
  item: Partial<Omit<WatchlistItem, "id" | "user_email" | "created_at">>
): Promise<void> {
  const fields = Object.keys(item);
  if (!fields.length) return;
  const c = await db();
  await c.execute({
    sql: `UPDATE watchlist SET ${fields.map((f) => `${f} = ?`).join(", ")} WHERE id = ? AND user_email = ?`,
    args: [...fields.map((f) => (item as Record<string, unknown>)[f] as InValue), id, userEmail],
  });
}

export async function removeFromWatchlist(userEmail: string, id: number): Promise<void> {
  const c = await db();
  await c.execute({ sql: "DELETE FROM watchlist WHERE id = ? AND user_email = ?", args: [id, userEmail] });
}

export async function getUsersWithAlerts(): Promise<string[]> {
  const c = await db();
  const r = await c.execute(
    "SELECT DISTINCT user_email FROM watchlist WHERE alert_above IS NOT NULL OR alert_below IS NOT NULL"
  );
  return r.rows.map((row) => row.user_email as string);
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

export interface Snapshot {
  id: number;
  user_email: string;
  taken_at: number;
  total_value: number;
  cash: number;
  pl: number;
}

export async function addSnapshot(
  userEmail: string,
  snap: { total_value: number; cash: number; pl: number }
): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "INSERT INTO snapshots (user_email, total_value, cash, pl) VALUES (?, ?, ?, ?)",
    args: [userEmail, snap.total_value, snap.cash, snap.pl],
  });
}

export async function getSnapshots(userEmail: string, days = 30): Promise<Snapshot[]> {
  const c = await db();
  const r = await c.execute({
    sql: "SELECT * FROM snapshots WHERE user_email = ? AND taken_at > unixepoch() - ? * 86400 ORDER BY taken_at ASC",
    args: [userEmail, days],
  });
  return r.rows as unknown as Snapshot[];
}

// ── Alert log ─────────────────────────────────────────────────────────────────

export async function wasAlertFiredRecently(
  userEmail: string,
  symbol: string,
  alertType: string,
  threshold: number,
  cooldownSeconds = 14_400
): Promise<boolean> {
  const c = await db();
  const r = await c.execute({
    sql: `SELECT id FROM alert_log
          WHERE user_email = ? AND symbol = ? AND alert_type = ?
            AND ABS(threshold - ?) < 0.001
            AND fired_at > unixepoch() - ?
          LIMIT 1`,
    args: [userEmail, symbol, alertType, threshold, cooldownSeconds],
  });
  return r.rows.length > 0;
}

export async function logAlert(
  userEmail: string,
  symbol: string,
  alertType: string,
  threshold: number,
  price: number
): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "INSERT INTO alert_log (user_email, symbol, alert_type, threshold, price) VALUES (?, ?, ?, ?, ?)",
    args: [userEmail, symbol, alertType, threshold, price],
  });
}

// ── Fallback log ──────────────────────────────────────────────────────────────

export async function logRequest(endpoint: string, usedFallback: boolean): Promise<void> {
  try {
    const c = await db();
    await c.execute({
      sql: "INSERT INTO fallback_log (endpoint, used_fallback) VALUES (?, ?)",
      args: [endpoint, usedFallback ? 1 : 0],
    });
  } catch { /* non-critical */ }
}

export async function getFallbackStats(): Promise<{ total: number; fallbacks: number }> {
  const c = await db();
  const [t, f] = await Promise.all([
    c.execute("SELECT COUNT(*) as n FROM fallback_log WHERE at > unixepoch() - 86400"),
    c.execute("SELECT COUNT(*) as n FROM fallback_log WHERE at > unixepoch() - 86400 AND used_fallback = 1"),
  ]);
  return {
    total: Number(t.rows[0]?.n ?? 0),
    fallbacks: Number(f.rows[0]?.n ?? 0),
  };
}
