import { NextRequest, NextResponse } from "next/server";
import { fetchTradingViewKeyStats } from "@/lib/tradingview/key-stats";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase() ?? "";

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const data = await fetchTradingViewKeyStats(symbol);
    return NextResponse.json({ data, source: "tradingview", fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        source: "tradingview",
        error: error instanceof Error ? error.message : "Failed to fetch TradingView key stats",
        fetchedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
