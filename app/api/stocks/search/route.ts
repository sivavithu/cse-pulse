import { NextRequest, NextResponse } from "next/server";
import { CSE_HEADERS } from "@/lib/cse/endpoints";

interface SecurityRow {
  id: number;
  name: string;
  symbol: string;
}

const SEARCH_SOURCE_URL = "https://www.cse.lk/api/allSecurityCode";
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedRows: SecurityRow[] | null = null;
let cacheExpiresAt = 0;

async function loadSecurityRows(): Promise<SecurityRow[]> {
  if (cachedRows && Date.now() < cacheExpiresAt) {
    return cachedRows;
  }

  const response = await fetch(SEARCH_SOURCE_URL, {
    headers: {
      ...CSE_HEADERS,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load security list: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const rows = Array.isArray(payload)
    ? payload.filter(
        (row): row is SecurityRow =>
          !!row &&
          typeof row === "object" &&
          typeof (row as SecurityRow).name === "string" &&
          typeof (row as SecurityRow).symbol === "string"
      )
    : [];

  cachedRows = rows;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return rows;
}

function rankRow(row: SecurityRow, query: string) {
  const symbol = row.symbol.toUpperCase();
  const name = row.name.toLowerCase();
  const queryUpper = query.toUpperCase();
  const queryLower = query.toLowerCase();

  if (symbol === queryUpper) return 0;
  if (symbol.startsWith(queryUpper)) return 1;
  if (name.startsWith(queryLower)) return 2;
  if (symbol.includes(queryUpper)) return 3;
  if (name.includes(queryLower)) return 4;
  return Number.POSITIVE_INFINITY;
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const rows = await loadSecurityRows();
    const results = rows
      .map((row) => ({ row, score: rankRow(row, query) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }
        return left.row.symbol.localeCompare(right.row.symbol);
      })
      .slice(0, 20)
      .map(({ row }) => ({
        symbol: row.symbol,
        name: row.name,
      }));

    return NextResponse.json({ results, source: "https://www.cse.lk/api/allSecurityCode" });
  } catch (error) {
    return NextResponse.json(
      { results: [], error: error instanceof Error ? error.message : String(error) },
      { status: 503 }
    );
  }
}
