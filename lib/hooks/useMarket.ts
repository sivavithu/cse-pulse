"use client";

import { useQuery } from "@tanstack/react-query";
import { pollInterval } from "@/lib/market-hours";
import { useUiStore } from "@/store/ui";
import { fetchBestQuoteFromApi } from "@/lib/cse/quotes";
import {
  normalizeMarketStatus,
  normalizeIndex,
  normalizeMover,
} from "@/lib/cse/normalize";
import type { MarketSummary, DataSource, StockKeyStats, StockQuote } from "@/lib/cse/types";

const ANNOUNCEMENT_ENDPOINTS = [
  "approvedAnnouncement",
  "getFinancialAnnouncement",
  "getNewListingsRelatedNoticesAnnouncements",
  "circularAnnouncement",
  "getBuyInBoardAnnouncements",
] as const;

const ANNOUNCEMENT_PAYLOAD_KEYS = [
  "approvedAnnouncements",
  "reqFinancialAnnouncemnets",
  "newListingRelatedAnnouncements",
  "reqCircularAnnouncement",
  "buyInBoardAnnouncements",
] as const;

async function cseApi(endpoint: string, body?: Record<string, unknown>) {
  const res = await fetch(`/api/cse/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export function useMarketSummary() {
  const setFallbackActive = useUiStore((s) => s.setFallbackActive);

  return useQuery<MarketSummary>({
    queryKey: ["market-summary"],
    queryFn: async () => {
      const [statusR, aspiR, snpR, gainR, lossR, activeR] = await Promise.allSettled([
        cseApi("marketStatus"),
        cseApi("aspiData"),
        cseApi("snpData"),
        cseApi("topGainers"),
        cseApi("topLooses"),
        cseApi("mostActiveTrades"),
      ]);

      const get = (r: PromiseSettledResult<{ data: unknown; source: string }>) =>
        r.status === "fulfilled" ? r.value : { data: null, source: "none" };

      const srcOf = (r: { data: unknown; source: string }): DataSource =>
        r.data == null ? "none" : (r.source === "fallback" ? "fallback" : "primary");

      const statusRes = get(statusR);
      const aspiRes = get(aspiR);
      const snpRes = get(snpR);
      const gainRes = get(gainR);
      const lossRes = get(lossR);
      const activeRes = get(activeR);

      const sources = {
        status: srcOf(statusRes),
        aspi: srcOf(aspiRes),
        snp: srcOf(snpRes),
        gainers: srcOf(gainRes),
        losers: srcOf(lossRes),
        mostActive: srcOf(activeRes),
      };
      const usedFallback = Object.values(sources).some((s) => s === "fallback");
      setFallbackActive(usedFallback);

      const aspiRaw = aspiRes.data as Record<string, unknown> | null;
      const snpRaw = snpRes.data as Record<string, unknown> | null;
      const statusRaw = statusRes.data as Record<string, unknown> | null;
      const gainers = (Array.isArray(gainRes.data) ? gainRes.data : []) as Record<string, unknown>[];
      const losers = (Array.isArray(lossRes.data) ? lossRes.data : []) as Record<string, unknown>[];
      const active = (Array.isArray(activeRes.data) ? activeRes.data : []) as Record<string, unknown>[];

      return {
        status: normalizeMarketStatus(statusRaw ?? {}),
        aspi: normalizeIndex(aspiRaw ?? {}),
        snp: normalizeIndex(snpRaw ?? {}),
        gainers: gainers.slice(0, 10).map(normalizeMover),
        losers: losers.slice(0, 10).map(normalizeMover),
        mostActive: active.slice(0, 10).map(normalizeMover),
        source: usedFallback ? "fallback" : "primary",
        sources,
        fetchedAt: new Date().toISOString(),
      };
    },
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
  });
}

function extractAnnouncementRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data as Record<string, unknown>[];
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const payload = data as Record<string, unknown>;
  for (const key of ANNOUNCEMENT_PAYLOAD_KEYS) {
    if (Array.isArray(payload[key])) {
      return payload[key] as Record<string, unknown>[];
    }
  }

  const firstArray = Object.values(payload).find(Array.isArray);
  return Array.isArray(firstArray) ? (firstArray as Record<string, unknown>[]) : [];
}

export function useStockQuote(symbol: string) {
  return useQuery<StockQuote | null>({
    queryKey: ["quote", symbol],
    queryFn: () => fetchBestQuoteFromApi(symbol),
    refetchInterval: pollInterval,
    enabled: !!symbol,
  });
}

export function useCompanyInfo(symbol: string) {
  return useQuery({
    queryKey: ["company", symbol],
    queryFn: async () => {
      const r = await cseApi("companyInfoSummery", { symbol });
      return r.data;
    },
    enabled: !!symbol,
    staleTime: 5 * 60_000,
  });
}

export function useTradingViewKeyStats(symbol: string) {
  return useQuery<StockKeyStats>({
    queryKey: ["tradingview-key-stats", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/tradingview/key-stats?symbol=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new Error(json.error ?? "Failed to fetch TradingView key stats");
      }
      return json.data as StockKeyStats;
    },
    enabled: !!symbol,
    staleTime: 15 * 60_000,
    retry: 1,
  });
}

export function useChartData(symbol: string, period = "1M") {
  return useQuery({
    queryKey: ["chart", symbol, period],
    queryFn: async () => {
      const r = await cseApi("companyChartDataByStock", { symbol, period });
      return (Array.isArray(r.data) ? r.data : []) as Record<string, unknown>[];
    },
    enabled: !!symbol,
    staleTime: 5 * 60_000,
  });
}

export function useAnnouncements(type = "approvedAnnouncement") {
  return useQuery({
    queryKey: ["announcements", type],
    queryFn: async () => {
      const r = await cseApi(type);
      return extractAnnouncementRows(r.data);
    },
    staleTime: 2 * 60_000,
  });
}

export function useAnnouncementFeed() {
  return useQuery({
    queryKey: ["announcement-feed"],
    queryFn: async () => {
      const results = await Promise.allSettled(
        ANNOUNCEMENT_ENDPOINTS.map(async (endpoint) => {
          const response = await cseApi(endpoint);
          return extractAnnouncementRows(response.data).map((row) => ({
            ...row,
            _endpoint: endpoint,
          }));
        })
      );

      if (results.every((result) => result.status === "rejected")) {
        throw new Error("Failed to load announcements");
      }

      return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    },
    staleTime: 2 * 60_000,
  });
}
