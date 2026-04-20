import { NextRequest, NextResponse } from "next/server";
import { runAlertCheck } from "@/lib/alerts/checker";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  const { users, checked } = await runAlertCheck();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  return NextResponse.json({ ok: true, elapsed, users, checked });
}
