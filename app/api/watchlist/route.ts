import { NextRequest, NextResponse } from "next/server";
import { getWatchlist, addToWatchlist, updateWatchlistItem, removeFromWatchlist } from "@/lib/db/queries";
import { currentUserEmail } from "@/lib/auth/session";

async function requireUser(): Promise<string | NextResponse> {
  const email = await currentUserEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return email;
}

export async function GET() {
  const user = await requireUser();
  if (typeof user !== "string") return user;
  return NextResponse.json({ watchlist: await getWatchlist(user) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (typeof user !== "string") return user;

  const body = await req.json();
  const { action } = body;

  if (action === "add") {
    await addToWatchlist(user, {
      symbol: body.symbol, company_name: body.company_name ?? null,
      alert_above: body.alert_above ?? null, alert_below: body.alert_below ?? null,
      announcement_alert: body.announcement_alert ?? 0,
    });
    return NextResponse.json({ ok: true });
  }
  if (action === "update") {
    const fields: Record<string, unknown> = {};
    for (const key of ["alert_above", "alert_below", "announcement_alert", "company_name"]) {
      if (key in body) fields[key] = body[key];
    }
    await updateWatchlistItem(user, body.id, fields);
    return NextResponse.json({ ok: true });
  }
  if (action === "remove") {
    await removeFromWatchlist(user, body.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
