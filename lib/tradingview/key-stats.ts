import type { StockKeyStats } from "@/lib/cse/types";

const SYMBOL_PAGE = "https://www.tradingview.com/symbols";

const STAT_LABELS: Array<[keyof StockKeyStats, string]> = [
  ["marketCapitalization", "Market capitalization"],
  ["dividendYield", "Dividend yield (indicated)"],
  ["priceToEarningsRatio", "Price to earnings Ratio (TTM)"],
  ["basicEps", "Basic EPS (TTM)"],
  ["netIncome", "Net income (FY)"],
  ["revenue", "Revenue (FY)"],
  ["sharesFloat", "Shares float"],
  ["beta1Y", "Beta (1Y)"],
];

const EMPTY_KEY_STATS: StockKeyStats = {
  marketCapitalization: "—",
  dividendYield: "—",
  priceToEarningsRatio: "—",
  basicEps: "—",
  netIncome: "—",
  revenue: "—",
  sharesFloat: "—",
  beta1Y: "—",
};

export async function fetchTradingViewKeyStats(symbol: string): Promise<StockKeyStats> {
  const upper = symbol.trim().toUpperCase();
  if (!upper) return EMPTY_KEY_STATS;

  const res = await fetch(`${SYMBOL_PAGE}/CSELK-${encodeURIComponent(upper)}/`, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`TradingView responded ${res.status}`);
  }

  const html = await res.text();
  const lines = htmlToLines(html);
  const knownLabels = new Set(STAT_LABELS.map(([, label]) => label));

  const stats = { ...EMPTY_KEY_STATS };

  for (const [key, label] of STAT_LABELS) {
    const index = lines.findIndex((line) => line === label);
    if (index === -1) continue;

    for (let i = index + 1; i < Math.min(lines.length, index + 6); i++) {
      const candidate = lines[i];
      if (!candidate) continue;
      if (knownLabels.has(candidate)) break;
      if (/show definition/i.test(candidate)) continue;
      stats[key] = candidate;
      break;
    }
  }

  return stats;
}

function htmlToLines(html: string): string[] {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const withLineBreaks = withoutScripts
    .replace(/<\/(div|p|li|section|article|header|footer|main|aside|nav|h[1-6]|td|th|tr|ul|ol|table|span|a)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtml(withLineBreaks)
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/[\u202f\u00a0]/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
