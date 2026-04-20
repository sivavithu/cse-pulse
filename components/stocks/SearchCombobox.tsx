"use client";

import { useState, useCallback, useRef, useEffect, useDeferredValue } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { StockQuickViewDialog } from "@/components/stocks/StockQuickViewDialog";

interface StockResult {
  symbol: string;
  name: string;
}

async function searchStocks(q: string): Promise<StockResult[]> {
  if (!q.trim() || q.length < 2) return [];
  const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) {
    return [];
  }
  const j = (await res.json()) as { results?: StockResult[] };
  return Array.isArray(j.results) ? j.results : [];
}

export function SearchCombobox() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query.trim());

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["search", deferredQuery],
    queryFn: () => searchStocks(deferredQuery),
    enabled: deferredQuery.length >= 2,
    staleTime: 5 * 60_000,
  });

  const select = useCallback(
    (symbol: string) => {
      setOpen(false);
      setQuery("");
      setSelectedSymbol(symbol);
    },
    []
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const showDropdown = open && query.length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stocks (e.g. COMB, SAMP)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          className="pl-9 pr-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="relative z-20 mt-2 overflow-hidden rounded-[1.25rem] border border-border/70 bg-popover/96 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.6)] backdrop-blur-2xl">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-2">
              {isLoading ? "Searching..." : "No results found."}
            </p>
          ) : (
            <ul>
              {results.map((r) => (
                <li
                  key={r.symbol}
                  className="flex cursor-pointer items-center gap-2 px-4 py-3 transition-colors hover:bg-accent/55"
                  onMouseDown={() => select(r.symbol)}
                >
                  <span className="font-medium font-mono text-sm">{r.symbol}</span>
                  <span className="text-muted-foreground text-sm truncate">{r.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedSymbol ? (
        <StockQuickViewDialog
          open={!!selectedSymbol}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedSymbol(null);
          }}
          symbol={selectedSymbol}
        />
      ) : null}
    </div>
  );
}
