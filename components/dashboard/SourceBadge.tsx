"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Globe, Bot, MinusCircle } from "lucide-react";
import type { DataSource } from "@/lib/cse/types";

interface Props {
  source: DataSource;
  className?: string;
}

const CONFIG = {
  primary: {
    label: "CSE API",
    title: "Fetched directly from cse.lk public API",
    icon: Globe,
    classes: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  fallback: {
    label: "Gemini",
    title: "Scraped by Gemini agent (CSE API unavailable)",
    icon: Bot,
    classes: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
  },
  none: {
    label: "No data",
    title: "Both primary and fallback failed",
    icon: MinusCircle,
    classes: "bg-muted text-muted-foreground border-border",
  },
} as const;

export function SourceBadge({ source, className }: Props) {
  const c = CONFIG[source];
  const Icon = c.icon;
  return (
    <Badge
      variant="outline"
      title={c.title}
      className={cn("gap-1 text-[10px] font-normal h-5 px-1.5 border", c.classes, className)}
    >
      <Icon className="h-2.5 w-2.5" />
      {c.label}
    </Badge>
  );
}
