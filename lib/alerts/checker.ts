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

const CHECK_INTERVAL_MS = 60 * 1000;
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

let running = false;

async function runCheck() {
  if (running) {
    console.log("[Alerts] Skipping - previous check still running");
    return;
  }
  running = true;
  const t0 = Date.now();

  try {
    const users = getUsersWithAlerts();
    if (!users.length) return;

    const alertable: Array<{
      userEmail: string;
      item: WatchlistItem;
      emailEnabled: boolean;
      recipient: string;
    }> = [];

    for (const userEmail of users) {
      const items = getWatchlist(userEmail).filter((item) => item.alert_above || item.alert_below);
      if (!items.length) continue;

      const emailEnabled = getUserSetting(userEmail, "alerts_email_enabled") === "true";
      const recipient = getUserSetting(userEmail, "alert_email") ?? "";

      for (const item of items) {
        alertable.push({ userEmail, item, emailEnabled, recipient });
      }
    }

    if (!alertable.length) return;

    const ltpCache = new Map<string, Promise<number>>();
    const ltpResults = await Promise.allSettled(
      alertable.map(({ item }) => {
        const cached = ltpCache.get(item.symbol);
        if (cached) return cached;

        const promise = getLTP(item.symbol);
        ltpCache.set(item.symbol, promise);
        return promise;
      })
    );

    for (let i = 0; i < alertable.length; i++) {
      const { userEmail, item, emailEnabled, recipient } = alertable[i];
      const result = ltpResults[i];
      const ltp = result.status === "fulfilled" ? result.value : 0;
      if (ltp === 0) continue;

      const checks: Array<{ type: string; threshold: number | null; hit: boolean }> = [
        { type: "above", threshold: item.alert_above, hit: !!(item.alert_above && ltp >= item.alert_above) },
        { type: "below", threshold: item.alert_below, hit: !!(item.alert_below && item.alert_below > 0 && ltp <= item.alert_below) },
      ];

      for (const { type, threshold, hit } of checks) {
        if (!hit || !threshold) continue;
        if (wasAlertFiredRecently(userEmail, item.symbol, type, threshold, COOLDOWN_SECONDS)) continue;

        logAlert(userEmail, item.symbol, type, threshold, ltp);

        const subject = `${item.symbol} price alert - ${type} LKR ${threshold.toLocaleString()}`;
        const line = `${item.symbol} (${item.company_name ?? ""}) is now at LKR ${ltp.toLocaleString()}, ${type} your alert of LKR ${threshold.toLocaleString()}.`;

        console.log(`[Alerts] ${userEmail}: ${subject} - LKR ${ltp}`);

        if (emailEnabled && recipient) {
          try {
            await sendAlertEmail({
              to: recipient,
              subject: `CSE Pulse - ${subject}`,
              text: line,
              html: `<p>${line}</p><p style="color:#64748b;font-size:12px">Sent by CSE Pulse. Not financial advice.</p>`,
            });
          } catch (err) {
            console.error(`[Alerts] Email failed for ${item.symbol}:`, err);
          }
        }
      }
    }

    console.log(
      `[Alerts] Check done in ${((Date.now() - t0) / 1000).toFixed(1)}s for ${alertable.length} alert(s) across ${users.length} user(s)`
    );
  } finally {
    running = false;
  }
}

export function startAlertChecker() {
  if (process.env.NODE_ENV === "test") return;

  console.log("[Alerts] Server-side price checker started (every 1 min)");

  setTimeout(() => {
    runCheck().catch((err) => console.error("[Alerts] Check error:", err));
    setInterval(() => {
      runCheck().catch((err) => console.error("[Alerts] Check error:", err));
    }, CHECK_INTERVAL_MS);
  }, 60_000);
}
