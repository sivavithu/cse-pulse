export const CSE_BASE = "https://www.cse.lk/api";

export const ENDPOINTS = {
  marketStatus: "marketStatus",
  marketSummery: "marketSummery",
  aspiData: "aspiData",
  snpData: "snpData",
  todaySharePrice: "todaySharePrice",
  tradeSummary: "tradeSummary",
  topGainers: "topGainers",
  topLooses: "topLooses",
  mostActiveTrades: "mostActiveTrades",
  companyInfoSummery: "companyInfoSummery",
  chartData: "chartData",
  companyChartDataByStock: "companyChartDataByStock",
  approvedAnnouncement: "approvedAnnouncement",
  getFinancialAnnouncement: "getFinancialAnnouncement",
  getNewListingsRelatedNoticesAnnouncements: "getNewListingsRelatedNoticesAnnouncements",
  circularAnnouncement: "circularAnnouncement",
  getBuyInBoardAnnouncements: "getBuyInBoardAnnouncements",
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;

export const CSE_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.cse.lk",
  Referer: "https://www.cse.lk/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
};
