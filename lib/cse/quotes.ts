import { normalizeQuote } from "./normalize";
import type { StockQuote } from "./types";

type QuoteRow = Record<string, unknown>;

interface CseRouteResponse {
  data?: unknown;
}

function asRow(value: unknown): QuoteRow | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as QuoteRow)
    : null;
}

function getRowSymbol(row: QuoteRow | null): string {
  return String(row?.symbol ?? row?.stockSymbol ?? row?.code ?? "")
    .trim()
    .toUpperCase();
}

function firstPositive(...values: number[]): number {
  for (const value of values) {
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 0;
}

function firstText(...values: string[]): string {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

async function fetchCseRoute(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/cse/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${endpoint}: ${response.status}`);
  }

  return (await response.json()) as CseRouteResponse;
}

export function extractTodaySharePriceRow(payload: unknown, symbol: string): QuoteRow | null {
  const expectedSymbol = symbol.trim().toUpperCase();

  if (Array.isArray(payload)) {
    const rows = payload.map(asRow).filter((row): row is QuoteRow => !!row);
    return rows.find((row) => getRowSymbol(row) === expectedSymbol) ?? null;
  }

  const row = asRow(payload);
  if (!row) {
    return null;
  }

  const rowSymbol = getRowSymbol(row);
  return !rowSymbol || rowSymbol === expectedSymbol ? row : null;
}

export function extractCompanyInfoRow(payload: unknown): QuoteRow | null {
  const root = asRow(payload);
  if (!root) {
    return null;
  }

  return asRow(root.reqSymbolInfo) ?? root;
}

export function buildBestQuote(symbol: string, livePayload: unknown, companyPayload: unknown): StockQuote | null {
  const liveRow = extractTodaySharePriceRow(livePayload, symbol);
  const companyRow = extractCompanyInfoRow(companyPayload);
  const liveQuote = liveRow ? normalizeQuote(liveRow) : null;
  const companyQuote = companyRow ? normalizeQuote(companyRow) : null;

  if (!liveQuote && !companyQuote) {
    return null;
  }

  const primary = liveQuote && liveQuote.lastPrice > 0 ? liveQuote : companyQuote ?? liveQuote;
  const secondary = primary === liveQuote ? companyQuote : liveQuote;

  if (!primary) {
    return null;
  }

  return {
    symbol: firstText(primary.symbol, secondary?.symbol ?? "", symbol.toUpperCase()).toUpperCase(),
    name: firstText(primary.name, secondary?.name ?? ""),
    lastPrice: firstPositive(primary.lastPrice, secondary?.lastPrice ?? 0),
    change: primary.change,
    changePct: primary.changePct,
    open: firstPositive(primary.open, secondary?.open ?? 0),
    high: firstPositive(primary.high, secondary?.high ?? 0),
    low: firstPositive(primary.low, secondary?.low ?? 0),
    close: firstPositive(primary.close, secondary?.close ?? 0),
    volume: firstPositive(primary.volume, secondary?.volume ?? 0),
    turnover: firstPositive(primary.turnover, secondary?.turnover ?? 0),
    trades: firstPositive(primary.trades, secondary?.trades ?? 0),
  };
}

export async function fetchBestQuoteFromApi(symbol: string): Promise<StockQuote | null> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) {
    return null;
  }

  const [liveResult, companyResult] = await Promise.allSettled([
    fetchCseRoute("todaySharePrice", { symbol: normalizedSymbol }),
    fetchCseRoute("companyInfoSummery", { symbol: normalizedSymbol }),
  ]);

  return buildBestQuote(
    normalizedSymbol,
    liveResult.status === "fulfilled" ? liveResult.value.data : null,
    companyResult.status === "fulfilled" ? companyResult.value.data : null
  );
}
