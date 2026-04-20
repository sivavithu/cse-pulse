export interface MarketStatus {
  isOpen: boolean;
  status: string;
  message: string;
}

export interface IndexData {
  value: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
}

export interface Mover {
  symbol: string;
  name: string;
  lastPrice: number;
  change: number;
  changePct: number;
  volume: number;
  turnover: number;
}

export interface StockQuote {
  symbol: string;
  name: string;
  lastPrice: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  trades: number;
}

export interface CompanyInfo {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  marketCapPercentage: number;
  eps: number;
  pe: number;
  roe: number;
  shares: number;
  dividendYield: number;
  parValue: number;
  issueDate: string;
  isin: string;
  betaAspi: number;
  betaSpsl: number;
  week52High: number;
  week52Low: number;
}

export interface StockKeyStats {
  marketCapitalization: string;
  dividendYield: string;
  priceToEarningsRatio: string;
  basicEps: string;
  netIncome: string;
  revenue: string;
  sharesFloat: string;
  beta1Y: string;
}

export interface ChartPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type AnnouncementCategory =
  | "rights"
  | "dividend"
  | "financial"
  | "corporate"
  | "listing"
  | "circular"
  | "other";

export interface Announcement {
  id: string;
  symbol: string;
  companyName: string;
  subject: string;
  category: AnnouncementCategory;
  date: string;
  pdfUrl: string | null;
  rawText?: string;
}

export type DataSource = "primary" | "fallback" | "none";

export interface SectionSources {
  status: DataSource;
  aspi: DataSource;
  snp: DataSource;
  gainers: DataSource;
  losers: DataSource;
  mostActive: DataSource;
}

export interface MarketSummary {
  status: MarketStatus;
  aspi: IndexData;
  snp: IndexData;
  gainers: Mover[];
  losers: Mover[];
  mostActive: Mover[];
  source: "primary" | "fallback";
  sources: SectionSources;
  fetchedAt: string;
}

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  source: "primary" | "fallback";
  fetchedAt: string;
}
