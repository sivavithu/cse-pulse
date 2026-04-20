"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  usePortfolio,
  useAddHolding,
  useUpdateHolding,
  useDeleteHolding,
  useSetBuyingPower,
  useSetCash,
  useSetTotalDeposit,
  useSetTotalDividend,
} from "@/lib/hooks/usePortfolio";
import { enrichHoldings, getAllocation } from "@/lib/portfolio/calc";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { AddHoldingDialog } from "@/components/portfolio/AddHoldingDialog";
import { ImportFromExcel } from "@/components/portfolio/ImportFromExcel";
import { ImportFromImage } from "@/components/portfolio/ImportFromImage";
import { AllocationPie } from "@/components/portfolio/AllocationPie";
import { PerformanceLine } from "@/components/portfolio/PerformanceLine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLKR, formatPct, plColor } from "@/lib/utils";
import { Plus, Wallet, TrendingUp, Loader2, Download, Bot, ImageIcon, Upload } from "lucide-react";
import { fetchBestQuoteFromApi } from "@/lib/cse/quotes";
import type { StockQuote } from "@/lib/cse/types";
import type { EnrichedHolding } from "@/lib/portfolio/calc";
import { toast } from "sonner";

async function fetchQuotes(symbols: string[]) {
  if (!symbols.length) return new Map();

  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  const results = await Promise.allSettled(
    uniqueSymbols.map(async (symbol) => ({
      symbol,
      quote: await fetchBestQuoteFromApi(symbol),
    }))
  );

  const map = new Map<string, StockQuote>();
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.quote) {
      map.set(result.value.symbol, result.value.quote);
    }
  }
  return map;
}

export default function PortfolioPage() {
  const { data: portfolio, isLoading } = usePortfolio();
  const addHolding = useAddHolding();
  const updateHolding = useUpdateHolding();
  const deleteHolding = useDeleteHolding();
  const setBuyingPower = useSetBuyingPower();
  const setCash = useSetCash();
  const setTotalDeposit = useSetTotalDeposit();
  const setTotalDividend = useSetTotalDividend();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [imageImportOpen, setImageImportOpen] = useState(false);
  const [editing, setEditing] = useState<EnrichedHolding | null>(null);
  const [buyingPowerInput, setBuyingPowerInput] = useState("");
  const [cashInput, setCashInput] = useState("");
  const [depositInput, setDepositInput] = useState("");
  const [dividendInput, setDividendInput] = useState("");
  const [editingBuyingPower, setEditingBuyingPower] = useState(false);
  const [editingCash, setEditingCash] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState(false);
  const [editingDividend, setEditingDividend] = useState(false);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const symbols = portfolio?.holdings.map((holding) => holding.symbol) ?? [];

  const { data: quotes = new Map(), isLoading: quotesLoading } = useQuery({
    queryKey: ["quotes", symbols.join(",")],
    queryFn: () => fetchQuotes(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 30_000,
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ["snapshots"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio?snapshots=1");
      const json = await response.json();
      return json.snapshots ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const summary = portfolio
    ? enrichHoldings(portfolio.holdings, quotes, portfolio.cash, portfolio.totalDeposit, portfolio.totalDividend)
    : null;

  useEffect(() => {
    if (portfolio?.buyingPower !== undefined) {
      setBuyingPowerInput(String(portfolio.buyingPower));
    }
  }, [portfolio?.buyingPower]);

  useEffect(() => {
    if (portfolio?.cash !== undefined) {
      setCashInput(String(portfolio.cash));
    }
  }, [portfolio?.cash]);

  useEffect(() => {
    if (portfolio?.totalDeposit !== undefined) {
      setDepositInput(String(portfolio.totalDeposit));
    }
  }, [portfolio?.totalDeposit]);

  useEffect(() => {
    if (portfolio?.totalDividend !== undefined) {
      setDividendInput(String(portfolio.totalDividend));
    }
  }, [portfolio?.totalDividend]);

  useEffect(() => {
    if (!summary) return;

    const last = localStorage.getItem("last_snapshot_date");
    const today = new Date().toDateString();
    if (last !== today && summary.totalMarketValue > 0) {
      fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "snapshot",
          total_value: summary.totalPortfolioValue,
          cash: summary.cashBalance,
          pl: summary.overallPL,
        }),
      });
      localStorage.setItem("last_snapshot_date", today);
    }
  }, [summary]);

  function exportCSV() {
    if (!summary) return;

    const rows = [
      ["Symbol", "Name", "Qty", "Avg Price", "LTP", "Market Value", "Net P&L", "Net P&L %"],
      ...summary.holdings.map((holding) => [
        holding.symbol,
        holding.company_name ?? "",
        holding.qty,
        holding.avg_price,
        holding.ltp,
        holding.marketValue,
        holding.pl,
        `${holding.plPct.toFixed(2)}%`,
      ]),
    ];

    const csv = rows.map((row) => row.join(",")).join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    anchor.download = `portfolio-${new Date().toISOString().split("T")[0]}.csv`;
    anchor.click();
  }

  async function getAiInsight() {
    if (!summary) return;

    setAiLoading(true);
    try {
      const holdingsText = summary.holdings
        .map(
          (holding) =>
            `${holding.symbol}: ${holding.qty} shares @ avg LKR${holding.avg_price}, LTP ${
              holding.ltp > 0 ? `LKR${holding.ltp}` : "N/A"
            }, open net P&L ${formatPct(holding.plPct)}`
        )
        .join("\n");

      const response = await fetch("/api/gemini/portfolio-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdingsText,
          totalValue: formatLKR(summary.totalPortfolioValue),
          pl: `${formatLKR(summary.adjustedOverallPL)} (${formatPct(summary.adjustedOverallPLPct)})`,
          aspi: "-",
          movers: "See dashboard for today's movers",
        }),
      });
      const json = await response.json();
      setAiInsight(json.text ?? json.error ?? "");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setAiLoading(false);
    }
  }

  async function saveCashBalance() {
    await setCash.mutateAsync(parseFloat(cashInput) || 0);
    setEditingCash(false);
    toast.success("Cash balance updated");
  }

  async function saveTotalDeposit() {
    await setTotalDeposit.mutateAsync(parseFloat(depositInput) || 0);
    setEditingDeposit(false);
    toast.success("Net CDS deposit updated");
  }

  async function saveTotalDividend() {
    await setTotalDividend.mutateAsync(parseFloat(dividendInput) || 0);
    setEditingDividend(false);
    toast.success("Total dividend updated");
  }

  if (isLoading) {
    return (
      <div className="page-shell">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const allocation = summary ? getAllocation(summary) : [];
  const manualBuyingPower = portfolio?.buyingPower ?? 0;
  const depositSet = summary ? summary.totalDeposit > 0 : false;
  // Only calculate fee loss when total deposit is explicitly set; otherwise it's meaningless
  const hiddenFeeLoss = depositSet && summary
    ? Math.max(0, summary.totalDeposit - (summary.totalCost + manualBuyingPower))
    : 0;
  const profitLossWithoutDividend = summary ? summary.totalMarketValue - summary.totalCost - hiddenFeeLoss : 0;
  const profitLossWithDividend = summary ? profitLossWithoutDividend + summary.totalDividend : 0;
  const profitLossWithoutDividendPct =
    summary && summary.totalCost > 0 ? (profitLossWithoutDividend / summary.totalCost) * 100 : 0;
  const profitLossWithDividendPct =
    summary && summary.totalCost > 0 ? (profitLossWithDividend / summary.totalCost) * 100 : 0;

  async function saveBuyingPower() {
    await setBuyingPower.mutateAsync(parseFloat(buyingPowerInput) || 0);
    setEditingBuyingPower(false);
    toast.success("Buying power updated");
  }

  async function replacePortfolioImport(
    holdings: { symbol: string; company_name: string | null; qty: number; avg_price: number }[],
    cash?: number
  ) {
    const existing = portfolio?.holdings ?? [];
    for (const holding of existing) {
      await deleteHolding.mutateAsync(holding.id);
    }
    for (const holding of holdings) {
      await addHolding.mutateAsync({ ...holding, notes: null });
    }
    if (cash !== undefined) {
      await setCash.mutateAsync(cash);
    }
    toast.success(
      `Portfolio replaced - ${holdings.length} holding${holdings.length > 1 ? "s" : ""} imported${
        cash !== undefined ? " with cash balance" : ""
      }${existing.length ? ` (${existing.length} removed)` : ""}`
    );
  }

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          My Portfolio
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExcelImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />
            Import from Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImageImportOpen(true)}>
            <ImageIcon className="h-4 w-4 mr-1.5" />
            Import from Image
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Holding
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Amount Spent</p>
              <p className="text-lg font-bold mt-0.5">{formatLKR(summary.totalCost)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sum of qty x avg price</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Market Value</p>
              <p className="text-lg font-bold mt-0.5">{formatLKR(summary.totalMarketValue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sum of qty x current price</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Hidden Fee Loss</p>
              {depositSet ? (
                <>
                  <p className={`text-lg font-bold mt-0.5 ${hiddenFeeLoss > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {hiddenFeeLoss > 0 ? "-" : ""}{formatLKR(hiddenFeeLoss)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Deposit − spent − buying power
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold mt-0.5 text-muted-foreground">—</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Set total deposit below to calculate</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">P/L Without Dividend</p>
              <p className={`text-lg font-bold mt-0.5 ${plColor(profitLossWithoutDividend)}`}>
                {formatLKR(profitLossWithoutDividend)}
              </p>
              <p className={`text-[10px] mt-0.5 ${plColor(profitLossWithoutDividend)}`}>
                {formatPct(profitLossWithoutDividendPct)}{" "}
                <span className="text-muted-foreground">Market value − spent{depositSet && hiddenFeeLoss > 0 ? " − fees" : ""}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">P/L With Dividend</p>
              <p className={`text-lg font-bold mt-0.5 ${plColor(profitLossWithDividend)}`}>
                {formatLKR(profitLossWithDividend)}
              </p>
              <p className={`text-[10px] mt-0.5 ${plColor(profitLossWithDividend)}`}>
                {formatPct(profitLossWithDividendPct)}{" "}
                <span className="text-muted-foreground">
                  Market value − spent{depositSet && hiddenFeeLoss > 0 ? " − fees" : ""} + dividend
                </span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Buying Power</p>
              <p className="text-lg font-bold mt-0.5">{formatLKR(manualBuyingPower)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Manually editable</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-4 grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Buying Power</Label>
            {editingBuyingPower ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="number"
                  value={buyingPowerInput}
                  onChange={(event) => setBuyingPowerInput(event.target.value)}
                  className="w-40 h-8"
                />
                <Button size="sm" onClick={saveBuyingPower}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingBuyingPower(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm">
                  <strong>{formatLKR(portfolio?.buyingPower ?? 0)}</strong>
                </span>
                <Button size="sm" variant="outline" onClick={() => setEditingBuyingPower(true)}>Edit</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Set this manually to match your broker&apos;s buying power.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Cash Balance</Label>
            {editingCash ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="number"
                  value={cashInput}
                  onChange={(event) => setCashInput(event.target.value)}
                  className="w-40 h-8"
                />
                <Button size="sm" onClick={saveCashBalance}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingCash(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm">
                  <strong>{formatLKR(portfolio?.cash ?? 0)}</strong>
                </span>
                <Button size="sm" variant="outline" onClick={() => setEditingCash(true)}>Edit</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Use the broker cash balance, not buying power.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Net CDS Deposit</Label>
            {editingDeposit ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="number"
                  value={depositInput}
                  onChange={(event) => setDepositInput(event.target.value)}
                  className="w-40 h-8"
                />
                <Button size="sm" onClick={saveTotalDeposit}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingDeposit(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm">
                  <strong>{formatLKR(portfolio?.totalDeposit ?? 0)}</strong>
                </span>
                <Button size="sm" variant="outline" onClick={() => setEditingDeposit(true)}>Edit</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              This lets the app show hidden loss from realized trades and commissions.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Total Dividend</Label>
            {editingDividend ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="number"
                  value={dividendInput}
                  onChange={(event) => setDividendInput(event.target.value)}
                  className="w-40 h-8"
                />
                <Button size="sm" onClick={saveTotalDividend}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingDividend(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm">
                  <strong>{formatLKR(portfolio?.totalDividend ?? 0)}</strong>
                </span>
                <Button size="sm" variant="outline" onClick={() => setEditingDividend(true)}>Edit</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              This is added on top of P/L With Dividend.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Holdings
            {quotesLoading && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                (updating prices...)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <HoldingsTable
            holdings={summary?.holdings ?? []}
            onEdit={(holding) => {
              setEditing(holding);
              setDialogOpen(true);
            }}
            onDelete={async (id) => {
              await deleteHolding.mutateAsync(id);
              toast.success("Holding removed");
            }}
          />
        </CardContent>
      </Card>

      {summary && summary.holdings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <AllocationPie data={allocation} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Performance (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceLine snapshots={snapshots} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Gemini Portfolio Insights
            </CardTitle>
            <Button size="sm" variant="outline" onClick={getAiInsight} disabled={aiLoading}>
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Bot className="h-4 w-4 mr-1.5" />
              )}
              Analyze
            </Button>
          </div>
        </CardHeader>
        {aiInsight && (
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiInsight}</p>
            <p className="text-xs text-muted-foreground mt-3">AI-generated. Not financial advice.</p>
          </CardContent>
        )}
      </Card>

      <AddHoldingDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        editing={editing}
        onSave={async (data) => {
          if (editing) {
            await updateHolding.mutateAsync({ id: editing.id, ...data });
            toast.success("Holding updated");
          } else {
            await addHolding.mutateAsync({
              ...data,
              company_name: data.company_name ?? null,
              notes: data.notes ?? null,
            });
            toast.success("Holding added");
          }
        }}
      />

      <ImportFromExcel
        open={excelImportOpen}
        onClose={() => setExcelImportOpen(false)}
        onImport={replacePortfolioImport}
      />

      <ImportFromImage
        open={imageImportOpen}
        onClose={() => setImageImportOpen(false)}
        onImport={replacePortfolioImport}
      />
    </div>
  );
}
