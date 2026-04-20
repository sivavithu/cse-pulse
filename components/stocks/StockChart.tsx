"use client";

import { useState } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChartData } from "@/lib/hooks/useMarket";
import { normalizeChartPoint } from "@/lib/cse/normalize";
import { formatLKR, formatNumber } from "@/lib/utils";

const PERIODS = ["1D", "1W", "1M", "3M", "1Y"] as const;

interface Props {
  symbol: string;
}

export function StockChart({ symbol }: Props) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("1M");
  const { data: raw, isLoading } = useChartData(symbol, period);

  const chartData = (raw ?? []).map((r) => normalizeChartPoint(r as Record<string, unknown>));

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? "default" : "ghost"}
            className="h-7 text-xs px-2.5"
            onClick={() => setPeriod(p)}
          >
            {p}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-[240px] w-full" />
      ) : chartData.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              yAxisId="price"
              orientation="left"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toFixed(2)}
              width={55}
            />
            <YAxis
              yAxisId="vol"
              orientation="right"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatNumber(v, true)}
              width={45}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(v, name) =>
                name === "volume"
                  ? [formatNumber(Number(v ?? 0), true), "Volume"]
                  : [formatLKR(Number(v ?? 0)), String(name)]
              }
            />
            <Bar yAxisId="vol" dataKey="volume" fill="hsl(var(--muted))" opacity={0.5} />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="close"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          No chart data available
        </div>
      )}
    </div>
  );
}
