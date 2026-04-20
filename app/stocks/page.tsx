"use client";

import { TrendingUp } from "lucide-react";
import { MoversList } from "@/components/dashboard/MoversList";
import { SearchCombobox } from "@/components/stocks/SearchCombobox";
import { Card, CardContent } from "@/components/ui/card";
import { useMarketSummary } from "@/lib/hooks/useMarket";

export default function StocksPage() {
  const { data: market, isLoading } = useMarketSummary();

  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="max-w-3xl">
          <p className="eyebrow">Quotes and Movers</p>
          <h1 className="hero-title">Stocks</h1>
          <p className="hero-copy">
            Search any listed counter, jump into a quick view, and keep the day&apos;s gainers, losers, and active names in reach.
          </p>
        </div>
      </section>

      <Card className="overflow-visible">
        <CardContent className="space-y-4 overflow-visible pt-5">
          <div>
            <p className="section-title">Search the Market</p>
            <p className="section-copy">Type at least two characters to find a stock and open its quick view.</p>
          </div>
          <SearchCombobox />
        </CardContent>
      </Card>

      <MoversList
        gainers={market?.gainers ?? []}
        losers={market?.losers ?? []}
        mostActive={market?.mostActive ?? []}
        loading={isLoading}
      />
    </div>
  );
}
