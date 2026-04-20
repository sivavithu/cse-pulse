import { NextRequest, NextResponse } from "next/server";
import {
  getHoldings, addHolding, updateHolding, deleteHolding,
  getUserSetting, setUserSetting, addSnapshot, getSnapshots,
} from "@/lib/db/queries";
import { currentUserEmail } from "@/lib/auth/session";

async function requireUser(): Promise<string | NextResponse> {
  const email = await currentUserEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return email;
}

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (typeof user !== "string") return user;

  const { searchParams } = new URL(req.url);
  if (searchParams.get("snapshots") === "1") {
    return NextResponse.json({ snapshots: await getSnapshots(user, 30) });
  }

  const [holdings, cashStr, storedDeposit, storedBP, storedDiv] = await Promise.all([
    getHoldings(user),
    getUserSetting(user, "cash_balance"),
    getUserSetting(user, "total_deposit"),
    getUserSetting(user, "buying_power"),
    getUserSetting(user, "total_dividend"),
  ]);

  const cash = parseFloat(cashStr ?? "0");
  const totalDividend = parseFloat(storedDiv ?? "0");
  const inferredDeposit = holdings.reduce((s, h) => s + h.qty * h.avg_price, 0) + cash;
  const parsedDeposit = storedDeposit != null ? parseFloat(storedDeposit) : NaN;
  const totalDeposit = Number.isFinite(parsedDeposit) && parsedDeposit > 0 ? parsedDeposit : inferredDeposit;
  const parsedBP = storedBP != null ? parseFloat(storedBP) : NaN;
  const buyingPower = Number.isFinite(parsedBP)
    ? parsedBP
    : totalDeposit - holdings.reduce((s, h) => s + h.qty * h.avg_price, 0);

  return NextResponse.json({ holdings, cash, totalDeposit, buyingPower, totalDividend });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (typeof user !== "string") return user;

  const body = await req.json();
  const { action } = body;

  if (action === "add") {
    const h = await addHolding(user, {
      symbol: body.symbol, company_name: body.company_name ?? null,
      qty: body.qty, avg_price: body.avg_price, notes: body.notes ?? null,
    });
    return NextResponse.json({ holding: h });
  }
  if (action === "update") {
    await updateHolding(user, body.id, {
      symbol: body.symbol, company_name: body.company_name,
      qty: body.qty, avg_price: body.avg_price, notes: body.notes,
    });
    return NextResponse.json({ ok: true });
  }
  if (action === "delete") { await deleteHolding(user, body.id); return NextResponse.json({ ok: true }); }
  if (action === "set_cash") { await setUserSetting(user, "cash_balance", String(body.amount ?? 0)); return NextResponse.json({ ok: true }); }
  if (action === "set_total_deposit") { await setUserSetting(user, "total_deposit", String(body.amount ?? 0)); return NextResponse.json({ ok: true }); }
  if (action === "set_total_dividend") { await setUserSetting(user, "total_dividend", String(body.amount ?? 0)); return NextResponse.json({ ok: true }); }
  if (action === "set_buying_power") { await setUserSetting(user, "buying_power", String(body.amount ?? 0)); return NextResponse.json({ ok: true }); }
  if (action === "snapshot") {
    await addSnapshot(user, { total_value: body.total_value, cash: body.cash, pl: body.pl });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
