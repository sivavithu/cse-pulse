"use client";

import Link from "next/link";
import { AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import { IndexCard } from "@/components/dashboard/IndexCard";
import { MarketStatusPill } from "@/components/dashboard/MarketStatusPill";
import { MoversList } from "@/components/dashboard/MoversList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketSummary } from "@/lib/hooks/useMarket";
import { usePortfolio } from "@/lib/hooks/usePortfolio";
import { formatLKR } from "@/lib/utils";

export default function DashboardPage() {
  const { data: market, isLoading: marketLoading, error: marketError } = useMarketSummary();
  const { data: portfolio } = usePortfolio();

  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="max-w-3xl">
          <p className="eyebrow">Today&apos;s Tape</p>
          <h1 className="hero-title">Market Overview</h1>
          <p className="hero-copy">
            Read the Colombo session at a glance, then move from indices into movers and your own positions without leaving the workspace.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          {market ? (
            <MarketStatusPill
              isOpen={market.status.isOpen}
              status={market.status.status}
              fetchedAt={market.fetchedAt}
              source={market.sources.status}
            />
          ) : (
            <Skeleton className="h-10 w-56 rounded-full" />
          )}
          <div className="panel-muted flex max-w-lg items-start gap-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>Unofficial app using public CSE data. Data may be delayed. Not financial advice.</span>
          </div>
        </div>
      </section>

      {marketError ? (
        <div className="rounded-3xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          Failed to load market data. Check your connection or enable the scraping fallback in Settings.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <IndexCard title="ASPI" data={market?.aspi} loading={marketLoading} source={market?.sources.aspi} />
            <IndexCard title="S&P SL20" data={market?.snp} loading={marketLoading} source={market?.sources.snp} />
          </div>

          {portfolio ? (
            <Link href="/portfolio" className="block">
              <Card className="cursor-pointer transition-transform duration-200 hover:-translate-y-0.5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Wallet className="h-4 w-4 text-primary" />
                    My Portfolio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="dense-label">Holdings</p>
                      <p className="mt-1 text-lg font-semibold">{portfolio.holdings.length} names</p>
                    </div>
                    <div>
                      <p className="dense-label">Cash Balance</p>
                      <p className="mt-1 text-lg font-semibold">{formatLKR(portfolio.cash, true)}</p>
                    </div>
                    <div>
                      <p className="dense-label">Total Cost</p>
                      <p className="mt-1 text-lg font-semibold">
                        {formatLKR(
                          portfolio.holdings.reduce((sum, holding) => sum + holding.avg_price * holding.qty, 0),
                          true
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ) : null}
        </div>

        {marketLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : market ? (
          <MoversList
            gainers={market.gainers}
            losers={market.losers}
            mostActive={market.mostActive}
            loading={false}
            sources={{
              gainers: market.sources.gainers,
              losers: market.sources.losers,
              mostActive: market.sources.mostActive,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
