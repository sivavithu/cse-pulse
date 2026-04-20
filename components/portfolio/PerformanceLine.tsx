"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Snapshot } from "@/lib/db/queries";
import { formatLKR } from "@/lib/utils";
import { format, fromUnixTime } from "date-fns";

interface Props {
  snapshots: Snapshot[];
}

export function PerformanceLine({ snapshots }: Props) {
  if (!snapshots.length) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Performance data builds up over time
      </div>
    );
  }

  const data = snapshots.map((s) => ({
    date: format(fromUnixTime(s.taken_at), "MMM d"),
    value: s.total_value,
    pl: s.pl,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatLKR(v, true)}
          width={70}
        />
        <Tooltip
          formatter={(v) => [formatLKR(Number(v ?? 0), true), "Portfolio Value"]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
