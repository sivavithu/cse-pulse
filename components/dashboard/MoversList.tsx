"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatLKR, formatPct, plBg } from "@/lib/utils";
import type { Mover, DataSource } from "@/lib/cse/types";
import { SourceBadge } from "./SourceBadge";
import { StockQuickViewTrigger } from "@/components/stocks/StockQuickViewTrigger";

interface Props {
  gainers: Mover[];
  losers: Mover[];
  mostActive: Mover[];
  loading?: boolean;
  sources?: { gainers: DataSource; losers: DataSource; mostActive: DataSource };
}

function MoverRow({ m }: { m: Mover }) {
  return (
    <StockQuickViewTrigger
      symbol={m.symbol}
      className="flex w-full items-center justify-between py-2 border-b last:border-0 hover:bg-muted/40 transition-colors rounded-md -mx-2 px-2 text-left"
    >
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{m.symbol}</p>
        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{m.name}</p>
      </div>
      <div className="text-right shrink-0 ml-2">
        <p className="text-sm font-medium">{formatLKR(m.lastPrice)}</p>
        <Badge className={plBg(m.change)} variant="secondary">
          {formatPct(m.changePct)}
        </Badge>
      </div>
    </StockQuickViewTrigger>
  );
}

export function MoversList({ gainers, losers, mostActive, loading, sources }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Market Movers</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="gainers">
          <TabsList className="w-full">
            <TabsTrigger value="gainers" className="flex-1 text-xs">Gainers</TabsTrigger>
            <TabsTrigger value="losers" className="flex-1 text-xs">Losers</TabsTrigger>
            <TabsTrigger value="active" className="flex-1 text-xs">Active</TabsTrigger>
          </TabsList>
          <TabsContent value="gainers" className="mt-3">
            {sources?.gainers && (
              <div className="flex justify-end mb-1.5"><SourceBadge source={sources.gainers} /></div>
            )}
            {gainers.length ? gainers.slice(0, 8).map((m) => <MoverRow key={m.symbol} m={m} />) : <p className="text-sm text-muted-foreground py-2">No data</p>}
          </TabsContent>
          <TabsContent value="losers" className="mt-3">
            {sources?.losers && (
              <div className="flex justify-end mb-1.5"><SourceBadge source={sources.losers} /></div>
            )}
            {losers.length ? losers.slice(0, 8).map((m) => <MoverRow key={m.symbol} m={m} />) : <p className="text-sm text-muted-foreground py-2">No data</p>}
          </TabsContent>
          <TabsContent value="active" className="mt-3">
            {sources?.mostActive && (
              <div className="flex justify-end mb-1.5"><SourceBadge source={sources.mostActive} /></div>
            )}
            {mostActive.length ? mostActive.slice(0, 8).map((m) => <MoverRow key={m.symbol} m={m} />) : <p className="text-sm text-muted-foreground py-2">No data</p>}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
