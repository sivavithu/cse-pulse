"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Holding } from "@/lib/db/queries";

type HoldingInput = Omit<Holding, "id" | "user_email" | "created_at">;
type HoldingUpdate = Partial<Omit<Holding, "user_email" | "created_at">> & { id: number };

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Portfolio API error ${res.status}`);
  return res.json();
}

export function usePortfolio() {
  return useQuery<{ holdings: Holding[]; cash: number; totalDeposit: number; buyingPower: number; totalDividend: number }>({
    queryKey: ["portfolio"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error("Failed to load portfolio");
      return res.json();
    },
    staleTime: 10_000,
  });
}

export function useAddHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (h: HoldingInput) => api({ action: "add", ...h }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
}

export function useUpdateHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...h }: HoldingUpdate) =>
      api({ action: "update", id, ...h }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
}

export function useDeleteHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api({ action: "delete", id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
}

export function useSetCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => api({ action: "set_cash", amount }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
}

export function useSetTotalDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => api({ action: "set_total_deposit", amount }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
}

export function useSetTotalDividend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => api({ action: "set_total_dividend", amount }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
}

export function useSetBuyingPower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => api({ action: "set_buying_power", amount }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist");
      if (!res.ok) throw new Error("Failed to load watchlist");
      return res.json();
    },
  });
}

export function useWatchlistMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["watchlist"] });

  const add = useMutation({
    mutationFn: (item: { symbol: string; company_name?: string; alert_above?: number; alert_below?: number }) =>
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", ...item }),
      }).then((r) => r.json()),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (item: { id: number; alert_above?: number; alert_below?: number; announcement_alert?: number }) =>
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...item }),
      }).then((r) => r.json()),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id }),
      }).then((r) => r.json()),
    onSuccess: invalidate,
  });

  return { add, update, remove };
}
