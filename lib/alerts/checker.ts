import {
  type WatchlistItem,
  getUsersWithAlerts,
  getUserSetting,
  getWatchlist,
  wasAlertFiredRecently,
  logAlert,
} from "@/lib/db/queries";
import { sendAlertEmail } from "@/lib/email";
import { csePost } from "@/lib/cse/client";
import { buildBestQuote } from "@/lib/cse/quotes";

const COOLDOWN_SECONDS = 4 * 60 * 60;

async function getLTP(symbol: string): Promise<number> {
  const [liveResult, companyResult] = await Promise.allSettled([
    csePost<unknown>("todaySharePrice", { symbol }),
    csePost<unknown>("companyInfoSummery", { symbol }),
  ]);
  const quote = buildBestQuote(
    symbol,
    liveResult.status === "fulfilled" ? liveResult.value : null,
    companyResult.status === "fulfilled" ? companyResult.value : null
  );
  return quote?.lastPrice ?? 0;
}

export async function runAlertCheck(): Promise<{ users: number; checked: number }> {
  const users = await getUsersWithAlerts();
  if (!users.length) return { users: 0, checked: 0 };

  const alertable: Array<{
    userEmail: string;
    item: WatchlistItem;
    emailEnabled: boolean;
    recipient: string;
  }> = [];

  for (const userEmail of users) {
    const [items, emailEnabled, recipient] = await Promise.all([
      getWatchlist(userEmail),
      getUserSetting(userEmail, "alerts_email_enabled"),
      getUserSetting(userEmail, "alert_email"),
    ]);
    for (const item of items.filter((i) => i.alert_above || i.alert_below)) {
      alertable.push({ userEmail, item, emailEnabled: emailEnabled === "true", recipient: recipient ?? "" });
    }
  }

  if (!alertable.length) return { users: users.length, checked: 0 };

  const ltpCache = new Map<string, Promise<number>>();
  const ltpResults = await Promise.allSettled(
    alertable.map(({ item }) => {
      if (!ltpCache.has(item.symbol)) ltpCache.set(item.symbol, getLTP(item.symbol));
      return ltpCache.get(item.symbol)!;
    })
  );

  let checked = 0;
  for (let i = 0; i < alertable.length; i++) {
    const { userEmail, item, emailEnabled, recipient } = alertable[i];
    const result = ltpResults[i];
    const ltp = result.status === "fulfilled" ? result.value : 0;
    if (ltp === 0) continue;
    checked++;

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
      console.log(`[Alerts] ${userEmail}: ${subject}`);

      if (emailEnabled && recipient) {
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

  return { users: users.length, checked };
}
