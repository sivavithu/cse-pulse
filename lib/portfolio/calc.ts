import type { Holding } from "@/lib/db/queries";
import type { StockQuote } from "@/lib/cse/types";

export interface EnrichedHolding extends Holding {
  ltp: number;
  marketValue: number;
  netMarketValue: number;
  estimatedSellCharges: number;
  cost: number;
  pl: number;
  plPct: number;
  dayChange: number;
  dayChangePct: number;
}

export interface PortfolioSummary {
  holdings: EnrichedHolding[];
  cashBalance: number;
  totalDeposit: number;
  totalDividend: number;
  totalCost: number;
  trackedCapital: number;
  hiddenPL: number;
  adjustedHiddenPL: number;
  totalMarketValue: number;
  estimatedExitValue: number;
  totalPL: number;
  totalPLPct: number;
  overallPL: number;
  overallPLPct: number;
  adjustedOverallPL: number;
  adjustedOverallPLPct: number;
  estimatedExitPL: number;
  estimatedExitPLPct: number;
  /** Available cash balance in the brokerage account. */
  buyingPower: number;
  /** Gross market value of holdings plus the available cash balance. */
  totalPortfolioValue: number;
  todayPL: number;
}

// CSE public investor material lists 1.120% total sell-side charges for equity trades up to LKR 100 Mn.
// This keeps P&L aligned with common Sri Lankan broker-app displays for normal retail trade sizes.
export const ESTIMATED_SELL_CHARGE_RATE = 0.0112;

export function enrichHoldings(
  holdings: Holding[],
  quotes: Map<string, StockQuote>,
  cashBalance = 0,
  totalDeposit = cashBalance,
  totalDividend = 0
): PortfolioSummary {
  const safeCashBalance = Number.isFinite(cashBalance) ? cashBalance : 0;
  const safeTotalDeposit = Number.isFinite(totalDeposit) ? totalDeposit : 0;
  const safeTotalDividend = Number.isFinite(totalDividend) ? totalDividend : 0;

  const enriched: EnrichedHolding[] = holdings.map((h) => {
    const q = quotes.get(h.symbol);
    const ltp = q?.lastPrice ?? 0;
    const marketValue = ltp * h.qty;
    const estimatedSellCharges = marketValue * ESTIMATED_SELL_CHARGE_RATE;
    const netMarketValue = marketValue - estimatedSellCharges;
    const cost = h.avg_price * h.qty;
    const pl = netMarketValue - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    const dayChange = (q?.change ?? 0) * h.qty;
    const dayChangePct = q?.changePct ?? 0;

    return {
      ...h,
      ltp,
      marketValue,
      netMarketValue,
      estimatedSellCharges,
      cost,
      pl,
      plPct,
      dayChange,
      dayChangePct,
    };
  });

  const totalCost = enriched.reduce((sum, holding) => sum + holding.cost, 0);
  const totalMarketValue = enriched.reduce((sum, holding) => sum + holding.marketValue, 0);
  const estimatedExitValue = enriched.reduce((sum, holding) => sum + holding.netMarketValue, 0) + safeCashBalance;
  const totalPL = enriched.reduce((sum, holding) => sum + holding.pl, 0);
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const todayPL = enriched.reduce((sum, holding) => sum + holding.dayChange, 0);
  const buyingPower = safeCashBalance;
  const totalPortfolioValue = totalMarketValue + buyingPower;
  const trackedCapital = totalCost + safeCashBalance;
  const hiddenPL = trackedCapital - safeTotalDeposit;
  const adjustedHiddenPL = hiddenPL + safeTotalDividend;
  const overallPL = totalPortfolioValue - safeTotalDeposit;
  const overallPLPct = safeTotalDeposit > 0 ? (overallPL / safeTotalDeposit) * 100 : 0;
  const adjustedOverallPL = overallPL + safeTotalDividend;
  const adjustedOverallPLPct = safeTotalDeposit > 0 ? (adjustedOverallPL / safeTotalDeposit) * 100 : 0;
  const estimatedExitPL = estimatedExitValue - safeTotalDeposit;
  const estimatedExitPLPct = safeTotalDeposit > 0 ? (estimatedExitPL / safeTotalDeposit) * 100 : 0;

  return {
    holdings: enriched,
    cashBalance: safeCashBalance,
    totalDeposit: safeTotalDeposit,
    totalDividend: safeTotalDividend,
    totalCost,
    trackedCapital,
    hiddenPL,
    adjustedHiddenPL,
    totalMarketValue,
    estimatedExitValue,
    totalPL,
    totalPLPct,
    overallPL,
    overallPLPct,
    adjustedOverallPL,
    adjustedOverallPLPct,
    estimatedExitPL,
    estimatedExitPLPct,
    buyingPower,
    totalPortfolioValue,
    todayPL,
  };
}

export interface AllocationSlice {
  name: string;
  symbol: string;
  value: number;
  pct: number;
  color: string;
}

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
];

export function getAllocation(summary: PortfolioSummary): AllocationSlice[] {
  const total = summary.totalMarketValue;
  if (total === 0) return [];

  return summary.holdings
    .map((h, i) => ({
      name: h.company_name ?? h.symbol,
      symbol: h.symbol,
      value: h.marketValue,
      pct: (h.marketValue / total) * 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);
}
