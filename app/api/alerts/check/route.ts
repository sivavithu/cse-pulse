import { NextRequest, NextResponse } from "next/server";
import { getWatchlist, getUserSetting, wasAlertFiredRecently, logAlert, getUsersWithAlerts } from "@/lib/db/queries";
import { sendAlertEmail } from "@/lib/email";
import { csePost } from "@/lib/cse/client";
import { normalizeQuote } from "@/lib/cse/normalize";

const COOLDOWN_SECONDS = 4 * 60 * 60;

async function getLTP(symbol: string): Promise<number> {
  try {
    const data = await csePost<Record<string, unknown>>("companyInfoSummery", { symbol });
    const raw = (data?.reqSymbolInfo ?? data) as Record<string, unknown> | null;
    if (!raw) return 0;
    const q = normalizeQuote(raw);
    if (q.lastPrice > 0) return q.lastPrice;
    return Number(raw.closingPrice ?? raw.previousClose ?? raw.close ?? 0);
  } catch { return 0; }
}

export async function GET(req: NextRequest) {
  // Verify the request comes from Vercel Cron or our own secret
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const t0 = Date.now();
  const users = await getUsersWithAlerts();
  let totalChecked = 0;

  for (const userEmail of users) {
    const items = await getWatchlist(userEmail);
    const alertable = items.filter((i) => i.alert_above || i.alert_below);
    if (!alertable.length) continue;

    const [emailEnabled, recipient] = await Promise.all([
      getUserSetting(userEmail, "alerts_email_enabled"),
      getUserSetting(userEmail, "alert_email"),
    ]);

    const ltpResults = await Promise.allSettled(alertable.map((i) => getLTP(i.symbol)));

    for (let i = 0; i < alertable.length; i++) {
      const item = alertable[i];
      const result = ltpResults[i];
      const ltp = result.status === "fulfilled" ? result.value : 0;
      if (ltp === 0) continue;
      totalChecked++;

      const checks = [
        { type: "above", threshold: item.alert_above, hit: !!(item.alert_above && ltp >= item.alert_above) },
        { type: "below", threshold: item.alert_below, hit: !!(item.alert_below && item.alert_below > 0 && ltp <= item.alert_below) },
      ];

      for (const { type, threshold, hit } of checks) {
        if (!hit || !threshold) continue;
        if (await wasAlertFiredRecently(userEmail, item.symbol, type, threshold, COOLDOWN_SECONDS)) continue;

        await logAlert(userEmail, item.symbol, type, threshold, ltp);

        const subject = `${item.symbol} price alert — ${type} LKR ${threshold.toLocaleString()}`;
        const line = `${item.symbol} is now at LKR ${ltp.toLocaleString()}, ${type} your alert of LKR ${threshold.toLocaleString()}.`;
        console.log(`[Alerts] ${userEmail} — ${subject}`);

        if (emailEnabled === "true" && recipient) {
          try {
            await sendAlertEmail({
              to: recipient,
              subject: `CSE Pulse — ${subject}`,
              text: line,
              html: `<p>${line}</p><p style="color:#64748b;font-size:12px">Sent by CSE Pulse. Not financial advice.</p>`,
            });
          } catch (err) {
            console.error(`[Alerts] Email failed for ${item.symbol}:`, err);
          }
        }
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[Alerts] Done in ${elapsed}s — ${totalChecked} symbols checked across ${users.length} user(s)`);
  return NextResponse.json({ ok: true, elapsed, users: users.length, checked: totalChecked });
}
