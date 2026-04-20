"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLKR, formatNumber, formatPct, plColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { IndexData, DataSource } from "@/lib/cse/types";
import { TrendingUp, TrendingDown } from "lucide-react";
import { SourceBadge } from "./SourceBadge";

interface Props {
  title: string;
  data?: IndexData;
  loading?: boolean;
  source?: DataSource;
}

export function IndexCard({ title, data, loading, source }: Props) {
  if (loading || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  const up = data.change >= 0;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {source && <SourceBadge source={source} />}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold">{formatNumber(data.value, false)}</p>
            <div className={cn("flex items-center gap-1 text-sm mt-0.5", plColor(data.change))}>
              {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span>{formatPct(data.changePct)}</span>
              <span className="text-muted-foreground">({up ? "+" : ""}{formatNumber(data.change, false)})</span>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <p>H: {formatNumber(data.high)}</p>
            <p>L: {formatNumber(data.low)}</p>
            <p>T/O: {formatLKR(data.turnover, true)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
