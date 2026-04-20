"use client";

import { cn } from "@/lib/utils";
import { formatColomboTime } from "@/lib/market-hours";
import { SourceBadge } from "./SourceBadge";
import type { DataSource } from "@/lib/cse/types";

interface Props {
  isOpen: boolean;
  status: string;
  fetchedAt?: string;
  source?: DataSource;
}

export function MarketStatusPill({ isOpen, status, fetchedAt, source }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
          isOpen
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
          )}
        />
        {isOpen ? "Market Open" : "Market Closed"}
      </span>
      {source && <SourceBadge source={source} />}
      {fetchedAt && (
        <span className="text-xs text-muted-foreground hidden sm:block">
          Updated {formatColomboTime(new Date(fetchedAt))}
        </span>
      )}
    </div>
  );
}
