"use client";

import { useCompanyInfo, useStockQuote, useTradingViewKeyStats } from "@/lib/hooks/useMarket";
import { useWatchlistMutations } from "@/lib/hooks/usePortfolio";
import { TradingViewChart } from "@/components/stocks/TradingViewChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeCompanyInfo } from "@/lib/cse/normalize";
import { cn, formatLKR, formatNumber, formatPct, plColor } from "@/lib/utils";
import { ExternalLink, Star, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  symbol: string;
  compact?: boolean;
}

export function StockOverview({ symbol, compact = false }: Props) {
  const { data: quote, isLoading: quoteLoading } = useStockQuote(symbol);
  const { data: rawInfo } = useCompanyInfo(symbol);
  const { data: keyStats, isLoading: keyStatsLoading } = useTradingViewKeyStats(symbol);
  const { add } = useWatchlistMutations();

  const companyPayload =
    rawInfo && typeof rawInfo === "object"
      ? (rawInfo as Record<string, unknown>)
      : null;

  const symbolInfo =
    companyPayload
      ? (companyPayload.reqSymbolInfo as Record<string, unknown> | undefined) ?? companyPayload
      : null;

  const betaInfo =
    companyPayload?.reqSymbolBetaInfo &&
    typeof companyPayload.reqSymbolBetaInfo === "object"
      ? (companyPayload.reqSymbolBetaInfo as Record<string, unknown>)
      : null;
  const info = symbolInfo ? normalizeCompanyInfo({ ...symbolInfo, ...(betaInfo ?? {}) }) : null;

  const companyFacts = [
    { label: "Market capitalization", value: keyStats?.marketCapitalization ?? "—" },
    { label: "Dividend yield (indicated)", value: keyStats?.dividendYield ?? "—" },
    { label: "Price to earnings Ratio (TTM)", value: keyStats?.priceToEarningsRatio ?? "—" },
    { label: "Basic EPS (TTM)", value: keyStats?.basicEps ?? "—" },
    { label: "Net income (FY)", value: keyStats?.netIncome ?? "—" },
    { label: "Revenue (FY)", value: keyStats?.revenue ?? "—" },
    { label: "Shares float", value: keyStats?.sharesFloat ?? "—" },
    { label: "Beta (1Y)", value: keyStats?.beta1Y ?? "—" },
  ];

  async function addToWatchlist() {
    await add.mutateAsync({
      symbol: symbol.toUpperCase(),
      company_name: quote?.name || info?.name || undefined,
    });
    toast.success(`${symbol.toUpperCase()} added to watchlist`);
  }

  function openCseCompanyProfile() {
    window.open(`https://www.cse.lk/company-profile?symbol=${encodeURIComponent(symbol.toUpperCase())}`, "_blank", "noopener,noreferrer");
  }

  function openTradingViewFullChart() {
    window.open(
      `https://www.tradingview.com/symbols/CSELK-${encodeURIComponent(symbol.toUpperCase())}/`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className={cn("font-bold font-mono", compact ? "text-xl" : "text-2xl")}>{symbol.toUpperCase()}</h1>
          {(quote?.name || info?.name) && (
            <p className="text-muted-foreground">{quote?.name || info?.name}</p>
          )}
          {info?.sector && <Badge variant="secondary" className="mt-1">{info.sector}</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={addToWatchlist}>
          <Star className="h-4 w-4 mr-1.5" />
          Watchlist
        </Button>
      </div>

      {quoteLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : quote && quote.lastPrice > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <p className="text-3xl font-bold">{formatLKR(quote.lastPrice)}</p>
                <div className={cn("flex items-center gap-1.5 mt-1", plColor(quote.change))}>
                  {quote.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="font-medium">{formatPct(quote.changePct)}</span>
                  <span>({quote.change >= 0 ? "+" : ""}{formatNumber(quote.change)})</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-right">
                <div><span className="text-muted-foreground">Open</span></div>
                <div>{formatLKR(quote.open)}</div>
                <div><span className="text-muted-foreground">High</span></div>
                <div>{formatLKR(quote.high)}</div>
                <div><span className="text-muted-foreground">Low</span></div>
                <div>{formatLKR(quote.low)}</div>
                <div><span className="text-muted-foreground">Volume</span></div>
                <div>{formatNumber(quote.volume, true)}</div>
                <div><span className="text-muted-foreground">Turnover</span></div>
                <div>{formatLKR(quote.turnover, true)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Price data not available for this stock right now.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Interactive Chart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TradingViewChart symbol={symbol} height={compact ? 520 : 620} />
          <div className="flex flex-wrap gap-3">
            <Button onClick={openTradingViewFullChart}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open full chart
            </Button>
            <Button variant="outline" onClick={openCseCompanyProfile}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open official CSE page
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Key Stats</CardTitle>
        </CardHeader>
        <CardContent>
          {keyStatsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 text-sm">
              {companyFacts.map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xl font-semibold tracking-tight">{value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
