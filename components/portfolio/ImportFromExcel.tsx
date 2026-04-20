"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn, formatLKR } from "@/lib/utils";
import { AlertCircle, CheckCircle, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface ExtractedHolding {
  symbol: string;
  company_name: string | null;
  qty: number;
  avg_price: number | null;
  current_price: number | null;
  _import: boolean;
}

interface ParsedWorkbook {
  holdings: ExtractedHolding[];
  sheetName: string;
  totalCost: number | null;
  totalMarketValue: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (
    holdings: { symbol: string; company_name: string | null; qty: number; avg_price: number }[],
    cash?: number
  ) => Promise<void> | void;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getColumnIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.some((candidate) => header === candidate || header.includes(candidate)));
}

function isHoldingSymbol(value: string) {
  return /^[A-Z0-9-]+\.[A-Z0-9]+$/.test(value);
}

function mergeDuplicateHoldings(rows: ExtractedHolding[]) {
  const merged = new Map<string, ExtractedHolding>();

  for (const row of rows) {
    const key = row.symbol.toUpperCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, row);
      continue;
    }

    const nextQty = existing.qty + row.qty;
    const existingAvg = existing.avg_price ?? 0;
    const rowAvg = row.avg_price ?? 0;
    const weightedAvg = nextQty > 0 ? (existing.qty * existingAvg + row.qty * rowAvg) / nextQty : null;

    merged.set(key, {
      ...existing,
      qty: nextQty,
      avg_price: weightedAvg !== null && weightedAvg > 0 ? weightedAvg : existing.avg_price ?? row.avg_price,
      current_price: row.current_price ?? existing.current_price,
      _import: existing._import || row._import,
    });
  }

  return Array.from(merged.values());
}

async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("No worksheet found in the Excel file");
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes("security") && headers.includes("quantity") && headers.includes("avg price");
  });

  if (headerRowIndex === -1) {
    throw new Error("Could not find Security, Quantity, and Avg Price columns in the Excel file");
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const securityIndex = getColumnIndex(headers, ["security"]);
  const quantityIndex = getColumnIndex(headers, ["quantity"]);
  const avgPriceIndex = getColumnIndex(headers, ["avg price"]);
  const totalCostIndex = getColumnIndex(headers, ["total cost"]);
  const tradedPriceIndex = getColumnIndex(headers, ["traded price"]);
  const marketValueIndex = getColumnIndex(headers, ["market value"]);

  if (securityIndex === -1 || quantityIndex === -1 || avgPriceIndex === -1) {
    throw new Error("The Excel file is missing one of the required columns: Security, Quantity, Avg Price");
  }

  const extracted: ExtractedHolding[] = [];
  let totalCost: number | null = null;
  let totalMarketValue: number | null = null;

  for (const row of rows.slice(headerRowIndex + 1)) {
    const firstCell = String(row[securityIndex] ?? "").trim();
    if (!firstCell) continue;

    if (normalizeHeader(firstCell) === "total") {
      totalCost = totalCostIndex >= 0 ? toNumber(row[totalCostIndex]) : null;
      totalMarketValue = marketValueIndex >= 0 ? toNumber(row[marketValueIndex]) : null;
      break;
    }

    const symbol = firstCell.toUpperCase();
    if (!isHoldingSymbol(symbol)) continue;

    const qty = toNumber(row[quantityIndex]);
    if (qty <= 0) continue;

    const avgPrice = avgPriceIndex >= 0 ? toNumber(row[avgPriceIndex]) : 0;
    const totalCostCell = totalCostIndex >= 0 ? toNumber(row[totalCostIndex]) : 0;
    const tradedPrice = tradedPriceIndex >= 0 ? toNumber(row[tradedPriceIndex]) : 0;
    const marketValue = marketValueIndex >= 0 ? toNumber(row[marketValueIndex]) : 0;

    const resolvedAvgPrice = avgPrice > 0 ? avgPrice : totalCostCell > 0 ? totalCostCell / qty : null;
    const resolvedCurrentPrice = tradedPrice > 0 ? tradedPrice : marketValue > 0 ? marketValue / qty : null;

    extracted.push({
      symbol,
      company_name: null,
      qty,
      avg_price: resolvedAvgPrice,
      current_price: resolvedCurrentPrice,
      _import: true,
    });
  }

  const holdings = mergeDuplicateHoldings(extracted);
  if (!holdings.length) {
    throw new Error("No holdings with quantity greater than zero were found in the Excel file");
  }

  return {
    holdings,
    sheetName,
    totalCost,
    totalMarketValue,
  };
}

export function ImportFromExcel({ open, onClose, onImport }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"upload" | "parsing" | "review">("upload");
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setStep("upload");
    setParsed(null);
    setError(null);
    setIsImporting(false);
  }, [open]);

  const setSelectedFile = useCallback((nextFile: File | null) => {
    setFile(nextFile);
    setError(null);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const dropped = Array.from(event.dataTransfer.files).find((candidate) =>
      /\.(xlsx|xls)$/i.test(candidate.name)
    );
    if (dropped) {
      setSelectedFile(dropped);
    }
  }, [setSelectedFile]);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedFile(nextFile);
    event.target.value = "";
  }, [setSelectedFile]);

  async function extract() {
    if (!file) return;
    setStep("parsing");
    setError(null);

    try {
      const workbook = await parseWorkbook(file);
      setParsed(workbook);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("upload");
    }
  }

  function updateField(index: number, field: keyof ExtractedHolding, value: string | number) {
    if (!parsed) return;

    setParsed({
      ...parsed,
      holdings: parsed.holdings.map((holding, rowIndex) =>
        rowIndex === index ? { ...holding, [field]: value } : holding
      ),
    });
  }

  function toggleRow(index: number) {
    if (!parsed) return;

    setParsed({
      ...parsed,
      holdings: parsed.holdings.map((holding, rowIndex) =>
        rowIndex === index ? { ...holding, _import: !holding._import } : holding
      ),
    });
  }

  function removeRow(index: number) {
    if (!parsed) return;

    setParsed({
      ...parsed,
      holdings: parsed.holdings.filter((_, rowIndex) => rowIndex !== index),
    });
  }

  async function doImport() {
    if (!parsed) return;

    const rows = parsed.holdings
      .filter((holding) => holding._import && holding.symbol && Number(holding.qty) > 0)
      .map((holding) => ({
        symbol: holding.symbol.toUpperCase().trim(),
        company_name: holding.company_name ?? null,
        qty: Number(holding.qty),
        avg_price: Number(holding.avg_price ?? holding.current_price ?? 0),
      }))
      .filter((holding) => holding.avg_price > 0);

    if (!rows.length) {
      toast.error("No valid holdings to import");
      return;
    }

    try {
      setIsImporting(true);
      await onImport(rows);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  }

  const selectedCount = parsed?.holdings.filter((holding) => holding._import).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import from Excel
          </DialogTitle>
          <DialogDescription>
            Upload your broker portfolio workbook. The imported holdings will replace the current portfolio.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
              onClick={() => {
                if (!file) inputRef.current?.click();
              }}
              className={cn(
                "relative border-2 border-dashed rounded-xl transition-colors",
                file ? "border-primary/40 bg-primary/5 p-3" : "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
              )}
            >
              {file ? (
                <div className="rounded-lg border bg-background p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                      Change file
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label htmlFor={inputId} className="flex flex-col items-center gap-3 py-10 cursor-pointer">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop an Excel file here or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports .xlsx and .xls files exported from your broker
                    </p>
                  </div>
                </label>
              )}
              <input
                id={inputId}
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="sr-only"
                onChange={handleFileInput}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" disabled={!file} onClick={extract}>
                <Upload className="h-4 w-4 mr-2" />
                Review Excel import
              </Button>
            </div>
          </div>
        )}

        {step === "parsing" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium">Reading workbook...</p>
              <p className="text-sm text-muted-foreground mt-1">Extracting symbols, quantities, and average prices</p>
            </div>
          </div>
        )}

        {step === "review" && parsed && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{parsed.sheetName}</Badge>
              <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                {parsed.holdings.length} holdings detected
              </Badge>
              {parsed.totalCost !== null && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Total cost: {formatLKR(parsed.totalCost, true)}
                  {parsed.totalMarketValue !== null ? `  |  Market value: ${formatLKR(parsed.totalMarketValue, true)}` : ""}
                </span>
              )}
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_80px_90px_90px_32px] gap-px bg-border text-xs font-medium text-muted-foreground">
                {["", "Symbol", "Qty", "Avg Price", "Curr. Price", ""].map((header, index) => (
                  <div key={index} className="bg-muted/50 px-2 py-2">{header}</div>
                ))}
              </div>
              {parsed.holdings.map((holding, index) => (
                <div
                  key={`${holding.symbol}-${index}`}
                  className={cn(
                    "grid grid-cols-[auto_1fr_80px_90px_90px_32px] gap-px bg-border",
                    !holding._import && "opacity-40"
                  )}
                >
                  <div className="bg-background px-2 py-1.5 flex items-center">
                    <input
                      type="checkbox"
                      checked={holding._import}
                      onChange={() => toggleRow(index)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                  </div>
                  <div className="bg-background px-2 py-1">
                    <Input
                      value={holding.symbol}
                      onChange={(event) => updateField(index, "symbol", event.target.value.toUpperCase())}
                      className="h-6 text-xs font-mono px-1 font-semibold"
                    />
                  </div>
                  <div className="bg-background px-1 py-1">
                    <Input
                      type="number"
                      value={holding.qty}
                      onChange={(event) => updateField(index, "qty", parseInt(event.target.value, 10) || 0)}
                      className="h-6 text-xs px-1"
                    />
                  </div>
                  <div className="bg-background px-1 py-1">
                    <Input
                      type="number"
                      step="0.00001"
                      value={holding.avg_price ?? ""}
                      placeholder="-"
                      onChange={(event) => updateField(index, "avg_price", parseFloat(event.target.value) || 0)}
                      className="h-6 text-xs px-1"
                    />
                  </div>
                  <div className="bg-background px-1 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={holding.current_price ?? ""}
                      placeholder="-"
                      onChange={(event) => updateField(index, "current_price", parseFloat(event.target.value) || 0)}
                      className="h-6 text-xs px-1"
                    />
                  </div>
                  <div className="bg-background flex items-center justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              This will <strong>replace</strong> your entire portfolio with the holdings shown above. Existing holdings will be removed.
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setParsed(null);
                  setFile(null);
                }}
              >
                Re-upload
              </Button>
              <Button className="flex-1" disabled={selectedCount === 0 || isImporting} onClick={doImport}>
                {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                {isImporting
                  ? "Replacing portfolio..."
                  : `Replace portfolio with ${selectedCount} holding${selectedCount !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
