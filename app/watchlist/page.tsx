"use client";

import { useEffect, useRef } from "react";
import { useWatchlist, useWatchlistMutations } from "@/lib/hooks/usePortfolio";
import { useQuery } from "@tanstack/react-query";
import { normalizeAnnouncement } from "@/lib/cse/normalize";
import { fetchBestQuoteFromApi } from "@/lib/cse/quotes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLKR, formatPct, plBg } from "@/lib/utils";
import { Star, Trash2, Bell, TrendingUp, TrendingDown, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { pollInterval } from "@/lib/market-hours";
import type { WatchlistItem } from "@/lib/db/queries";
import { StockQuickViewTrigger } from "@/components/stocks/StockQuickViewTrigger";

const ANNOUNCEMENT_ENDPOINTS = [
  "approvedAnnouncement",
  "getFinancialAnnouncement",
  "getNewListingsRelatedNoticesAnnouncements",
  "circularAnnouncement",
] as const;

const ANNOUNCEMENT_PAYLOAD_KEYS = [
  "approvedAnnouncements",
  "reqFinancialAnnouncemnets",
  "newListingRelatedAnnouncements",
  "reqCircularAnnouncement",
];

function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (!data || typeof data !== "object") return [];
  const p = data as Record<string, unknown>;
  for (const key of ANNOUNCEMENT_PAYLOAD_KEYS) {
    if (Array.isArray(p[key])) return p[key] as Record<string, unknown>[];
  }
  const first = Object.values(p).find(Array.isArray);
  return Array.isArray(first) ? (first as Record<string, unknown>[]) : [];
}

function seenKey(symbol: string) {
  return `seen_ann_${symbol}`;
}

function getSeenIds(symbol: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(symbol));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(symbol: string, ids: string[]) {
  try {
    const existing = getSeenIds(symbol);
    ids.forEach((id) => existing.add(id));
    // Keep only latest 200 IDs to avoid unbounded growth.
    const trimmed = [...existing].slice(-200);
    localStorage.setItem(seenKey(symbol), JSON.stringify(trimmed));
  } catch { /* storage full — ignore */ }
}

export default function WatchlistPage() {
  const { data: wl, isLoading } = useWatchlist();
  const { remove, update } = useWatchlistMutations();
  const items: WatchlistItem[] = wl?.watchlist ?? [];
  const alerted = useRef<Set<string>>(new Set());

  const alertedSymbols = items
    .filter((i) => i.announcement_alert === 1)
    .map((i) => i.symbol.toUpperCase());

  const symbols = items.map((i) => i.symbol);

  const { data: quotes = new Map() } = useQuery({
    queryKey: ["wl-quotes", symbols.join(",")],
    queryFn: async () => {
      const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
      const map = new Map();
      await Promise.allSettled(
        uniqueSymbols.map(async (symbol) => {
          const quote = await fetchBestQuoteFromApi(symbol);
          if (quote) {
            map.set(symbol, quote);
          }
        })
      );
      return map;
    },
    enabled: symbols.length > 0,
    refetchInterval: pollInterval,
  });

  // Announcement feed — only fetch when at least one item has the alert on.
  useQuery({
    queryKey: ["wl-announcements", alertedSymbols.join(",")],
    queryFn: async () => {
      const results = await Promise.allSettled(
        ANNOUNCEMENT_ENDPOINTS.map((ep) =>
          fetch(`/api/cse/${ep}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
            .then((r) => r.json())
            .then((j) => extractRows(j.data))
        )
      );
      const rows = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const announcements = rows.map(normalizeAnnouncement).filter((a) => a.subject);

      for (const sym of alertedSymbols) {
        const matching = announcements.filter(
          (a) => a.symbol.toUpperCase() === sym || a.companyName.toUpperCase().includes(sym.split(".")[0])
        );
        if (!matching.length) continue;

        const seen = getSeenIds(sym);
        const fresh = matching.filter((a) => !seen.has(a.id));
        if (!fresh.length) continue;

        markSeen(sym, fresh.map((a) => a.id));

        for (const ann of fresh) {
          const msg = `${sym}: ${ann.subject}`;
          toast.info(msg, { duration: 8000 });
          fetch("/api/alerts/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subject: `CSE Pulse — Announcement: ${sym}`,
              text: `${ann.subject}\n\nCompany: ${ann.companyName}\nDate: ${ann.date}${ann.pdfUrl ? `\nPDF: ${ann.pdfUrl}` : ""}`,
              lines: [
                `<strong>${sym}</strong> — ${ann.subject}`,
                `Company: ${ann.companyName}`,
                `Date: ${ann.date}`,
                ann.pdfUrl ? `<a href="${ann.pdfUrl}">View PDF</a>` : "",
              ].filter(Boolean),
            }),
          }).catch(() => {});
        }
      }

      return announcements;
    },
    enabled: alertedSymbols.length > 0,
    refetchInterval: 5 * 60_000, // poll every 5 minutes
    staleTime: 4 * 60_000,
  });

  // Price alert notifications
  useEffect(() => {
    for (const item of items) {
      const q = quotes.get(item.symbol.toUpperCase());
      if (!q) continue;

      const aboveHit = !!(item.alert_above && q.lastPrice >= item.alert_above);
      const belowHit = !!(item.alert_below && item.alert_below > 0 && q.lastPrice <= item.alert_below);
      if (!aboveHit && !belowHit) continue;

      const direction = aboveHit ? "above" : "below";
      const threshold = aboveHit ? item.alert_above : item.alert_below;
      const key = `${item.symbol}-${direction}-${threshold}`;
      if (alerted.current.has(key)) continue;
      alerted.current.add(key);

      const subject = `${item.symbol} ${direction} ${formatLKR(threshold!)}`;
      const line = `${item.symbol} is at ${formatLKR(q.lastPrice)} (${formatPct(q.changePct)}), ${direction} your alert of ${formatLKR(threshold!)}.`;

      if (aboveHit) toast.info(subject);
      else toast.warning(subject);

      fetch("/api/alerts/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: `CSE Pulse — ${subject}`, text: line, lines: [line] }),
      }).catch(() => {});
    }
  }, [quotes, items]);

  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="max-w-3xl">
          <p className="eyebrow">Monitored Names</p>
          <h1 className="hero-title">Watchlist</h1>
          <p className="hero-copy">
            Keep price thresholds and filing alerts on the same canvas so monitored names stay actionable instead of passive.
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="mx-auto max-w-3xl">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No stocks in watchlist.</p>
            <p className="text-xs mt-1">Search for a stock and add it to watchlist.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full space-y-3">
          {items.map((item) => {
            const q = quotes.get(item.symbol.toUpperCase());
            return (
              <Card key={item.id} className="transition-transform duration-200 hover:-translate-y-0.5">
                <CardContent className="pt-3 pb-3 space-y-2">
                  {/* Row 1: symbol + price + delete */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <StockQuickViewTrigger
                        symbol={item.symbol}
                        className="font-bold font-mono hover:text-primary transition-colors"
                      >
                        {item.symbol}
                      </StockQuickViewTrigger>
                      {item.company_name && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.company_name}</p>
                      )}
                    </div>

                    {q ? (
                      <div className="text-right">
                        <p className="font-semibold">{formatLKR(q.lastPrice)}</p>
                        <Badge className={plBg(q.change)} variant="secondary">
                          {q.change >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                          {formatPct(q.changePct)}
                        </Badge>
                      </div>
                    ) : (
                      <Skeleton className="h-10 w-20" />
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => { remove.mutate(item.id); toast.success(`${item.symbol} removed`); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Row 2: price alerts + announcement alert */}
                  <div className="flex items-center gap-3 flex-wrap pt-0.5">
                    <NumericField
                      icon={<Bell className="h-3 w-3 text-amber-500" />}
                      label="Alert ↑"
                      value={item.alert_above ?? undefined}
                      onSave={(v) => update.mutate({ id: item.id, alert_above: v })}
                    />
                    <NumericField
                      icon={<Bell className="h-3 w-3 text-blue-500" />}
                      label="Alert ↓"
                      value={item.alert_below ?? undefined}
                      onSave={(v) => update.mutate({ id: item.id, alert_below: v })}
                    />
                    <button
                      className={`ml-auto flex items-center gap-1.5 text-xs rounded-md px-2 py-1 border transition-colors ${
                        item.announcement_alert
                          ? "border-violet-400 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                          : "border-border text-muted-foreground hover:border-violet-400"
                      }`}
                      onClick={() => update.mutate({ id: item.id, announcement_alert: item.announcement_alert ? 0 : 1 })}
                      title="Toggle announcement alerts"
                    >
                      <Megaphone className="h-3 w-3" />
                      Announcements
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NumericField({
  icon, label, value, onSave,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  onSave: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <Input
        type="number"
        defaultValue={value}
        className="h-6 w-20 text-xs px-1.5"
        onBlur={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v !== value) onSave(v);
        }}
        placeholder="—"
      />
    </div>
  );
}
