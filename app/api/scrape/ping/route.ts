import { NextRequest, NextResponse } from "next/server";
import { scrapeUrl, type ScraperService } from "@/lib/scrape";

export async function POST(req: NextRequest) {
  const { service, apiKey } = await req.json();

  if (!service || service === "none") {
    return NextResponse.json({ ok: false, error: "No service selected" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "API key required" }, { status: 400 });
  }

  try {
    const result = await scrapeUrl("https://www.cse.lk/", service as ScraperService, apiKey);
    const ok = result.content.length > 100;
    return NextResponse.json({
      ok,
      chars: result.content.length,
      error: ok ? null : "Response too short — check your API key",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
