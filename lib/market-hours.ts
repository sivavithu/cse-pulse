// CSE trades Mon–Fri 09:30–14:30 Colombo time (Asia/Colombo = UTC+5:30)
export function isMarketOpen(): boolean {
  const now = new Date();
  const colombo = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  const day = colombo.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const h = colombo.getHours();
  const m = colombo.getMinutes();
  const minutes = h * 60 + m;
  return minutes >= 9 * 60 + 30 && minutes < 14 * 60 + 30;
}

export function getColomboTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
}

export function pollInterval(): number {
  return isMarketOpen() ? 30_000 : 300_000;
}

export function formatColomboTime(date?: Date): string {
  const d = date ?? new Date();
  return d.toLocaleTimeString("en-LK", { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
