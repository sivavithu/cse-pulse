import type {
  MarketStatus,
  IndexData,
  Mover,
  StockQuote,
  ChartPoint,
  Announcement,
  AnnouncementCategory,
  CompanyInfo,
} from "./types";

function n(v: unknown): number {
  const x = parseFloat(String(v ?? "0").replace(/,/g, ""));
  return isNaN(x) ? 0 : x;
}

function s(v: unknown): string {
  return String(v ?? "").trim();
}

function absoluteCseUrl(v: unknown): string | null {
  const value = s(v);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://www.cse.lk/${value.replace(/^\/+/, "")}`;
}

function formatAnnouncementDate(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(v).toLocaleString("en-LK", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const value = s(v);
  if (!value) return "";

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 1_000_000_000) {
    return formatAnnouncementDate(asNumber);
  }

  return value;
}

export function normalizeMarketStatus(raw: Record<string, unknown>): MarketStatus {
  const status = s(raw.marketStatus || raw.status || raw.tradingStatus || "");
  return {
    isOpen: /open/i.test(status),
    status: status || "Unknown",
    message: s(raw.message || raw.msg || ""),
  };
}

export function normalizeIndex(raw: Record<string, unknown>): IndexData {
  return {
    value: n(raw.indexValue ?? raw.value ?? raw.index),
    change: n(raw.change ?? raw.indexChange),
    changePct: n(raw.percentage ?? raw.percentageChange ?? raw.changePercentage ?? raw.pct),
    high: n(raw.highValue ?? raw.high ?? raw.dayHigh ?? raw.highIndex),
    low: n(raw.lowValue ?? raw.low ?? raw.dayLow ?? raw.lowIndex),
    volume: n(raw.volume ?? raw.turnoverVolume),
    turnover: n(raw.turnover ?? raw.turnoverValue ?? raw.totalTurnover),
  };
}

export function normalizeMover(raw: Record<string, unknown>): Mover {
  return {
    symbol: s(raw.symbol ?? raw.stockSymbol ?? raw.code),
    name: s(raw.name ?? raw.companyName ?? raw.stockName),
    lastPrice: n(raw.price ?? raw.lastTradedPrice ?? raw.lastPrice ?? raw.tradePrice ?? raw.closingPrice ?? raw.ltp),
    change: n(raw.change ?? raw.priceChange),
    changePct: n(raw.changePercentage ?? raw.percentageChange ?? raw.pct),
    volume: n(raw.volume ?? raw.tradeVolume ?? raw.quantity),
    turnover: n(raw.turnover ?? raw.tradeValue ?? raw.turnoverValue),
  };
}

export function normalizeQuote(raw: Record<string, unknown>): StockQuote {
  return {
    symbol: s(raw.symbol ?? raw.stockSymbol ?? raw.code),
    name: s(raw.name ?? raw.companyName ?? raw.stockName),
    lastPrice: n(raw.lastTradedPrice ?? raw.price ?? raw.lastPrice ?? raw.tradePrice ?? raw.ltp),
    change: n(raw.change ?? raw.priceChange),
    changePct: n(raw.changePercentage ?? raw.percentageChange),
    open: n(raw.open ?? raw.openingPrice),
    high: n(raw.high ?? raw.highPrice ?? raw.hiTrade),
    low: n(raw.low ?? raw.lowPrice ?? raw.lowTrade),
    close: n(raw.closingPrice ?? raw.close ?? raw.previousClose),
    volume: n(raw.crossingVolume ?? raw.quantity ?? raw.volume ?? raw.tradeVolume ?? raw.tdyShareVolume),
    turnover: n(raw.turnover ?? raw.tradeValue ?? raw.turnoverValue ?? raw.tdyTurnover),
    trades: n(raw.trades ?? raw.noOfTrades ?? raw.tdyTradeVolume),
  };
}

export function normalizeChartPoint(raw: Record<string, unknown>): ChartPoint {
  return {
    date: s(raw.date ?? raw.dateTime ?? raw.tradingDate),
    open: n(raw.open ?? raw.openingPrice),
    high: n(raw.high ?? raw.highPrice),
    low: n(raw.low ?? raw.lowPrice),
    close: n(raw.close ?? raw.closingPrice ?? raw.lastTradedPrice),
    volume: n(raw.volume),
  };
}

const CATEGORY_KEYWORDS: Record<AnnouncementCategory, RegExp> = {
  rights: /rights?\s*issue|rights?\s*entitlement/i,
  dividend: /dividend|interim\s*dividend|final\s*dividend/i,
  financial: /financial\s*result|annual\s*report|quarterly|interim\s*financial|audited/i,
  corporate: /board\s*of\s*director|agm|egm|change\s*of\s*director|merger|acquisition|debenture/i,
  listing: /listing|new\s*listing|ipo|public\s*offer/i,
  circular: /circular|notice\s*to\s*shareholders/i,
  other: /./,
};

export function categorizeAnnouncement(subject: string): AnnouncementCategory {
  for (const [cat, re] of Object.entries(CATEGORY_KEYWORDS) as [AnnouncementCategory, RegExp][]) {
    if (cat !== "other" && re.test(subject)) return cat;
  }
  return "other";
}

export function normalizeAnnouncement(raw: Record<string, unknown>): Announcement {
  const subject = s(
    raw.subject ??
      raw.title ??
      raw.announcementTitle ??
      raw.description ??
      raw.fileText ??
      raw.remarks ??
      raw.announcementCategory
  );
  const categoryText = s(raw.announcementCategory);
  const rawText = [categoryText, s(raw.remarks), s(raw.fileText), s(raw.description)]
    .filter(Boolean)
    .join("\n");

  return {
    id: s(raw.id ?? raw.announcementId ?? raw.noticeId ?? raw.path ?? Math.random()),
    symbol: s(raw.symbol ?? raw.stockSymbol ?? raw.code ?? ""),
    companyName: s(raw.companyName ?? raw.name ?? raw.company ?? ""),
    subject,
    category: categorizeAnnouncement([subject, categoryText, rawText].filter(Boolean).join(" ")),
    date: formatAnnouncementDate(
      raw.date ??
        raw.announcementDate ??
        raw.publishedDate ??
        raw.dateTime ??
        raw.dateOfAnnouncement ??
        raw.authorizedDate ??
        raw.uploadedDate ??
        raw.createdDate ??
        raw.manualDate
    ),
    pdfUrl: absoluteCseUrl(raw.pdfLink ?? raw.documentLink ?? raw.link ?? raw.path),
    rawText,
  };
}

export function normalizeCompanyInfo(raw: Record<string, unknown>): CompanyInfo {
  return {
    symbol: s(raw.symbol ?? raw.stockSymbol ?? raw.code),
    name: s(raw.companyName ?? raw.name),
    sector: s(raw.sector ?? raw.industry ?? raw.market),
    marketCap: n(raw.marketCap ?? raw.marketCapitalization),
    marketCapPercentage: n(raw.marketCapPercentage ?? raw.totalMarketCapPercentage),
    eps: n(raw.eps ?? raw.earningsPerShare),
    pe: n(raw.pe ?? raw.priceEarningsRatio),
    roe: n(raw.roe ?? raw.returnOnEquity),
    shares: n(raw.shares ?? raw.outstandingShares ?? raw.issuedShares ?? raw.quantityIssued),
    dividendYield: n(raw.dividendYield ?? raw.yieldPercentage),
    parValue: n(raw.parValue),
    issueDate: s(raw.issueDate),
    isin: s(raw.isin),
    betaAspi: n(raw.triASIBetaValue ?? raw.betaValueAspi),
    betaSpsl: n(raw.betaValueSPSL ?? raw.betaValueSpsl),
    week52High: n(raw.p12HiPrice ?? raw.week52High ?? raw.high52Week),
    week52Low: n(raw.p12LowPrice ?? raw.week52Low ?? raw.low52Week),
  };
}
