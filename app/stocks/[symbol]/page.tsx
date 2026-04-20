"use client";

import { use } from "react";
import { StockOverview } from "@/components/stocks/StockOverview";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = use(params);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <Link
        href="/stocks"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Stocks
      </Link>

      <StockOverview symbol={symbol} />
    </div>
  );
}
