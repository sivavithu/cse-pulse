"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ImageIcon, Upload, Loader2, CheckCircle, AlertCircle,
  Trash2, Plus, X, ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatLKR } from "@/lib/utils";

interface ExtractedHolding {
  symbol: string;
  company_name: string | null;
  qty: number;
  avg_price: number | null;
  current_price: number | null;
  _import: boolean; // user can deselect rows
}

interface ExtractedData {
  holdings: ExtractedHolding[];
  cash_balance: number | null;
  total_portfolio_value: number | null;
  broker: string | null;
  confidence: "high" | "medium" | "low";
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (holdings: { symbol: string; company_name: string | null; qty: number; avg_price: number }[], cash?: number) => Promise<void> | void;
}

const CONFIDENCE_STYLE = {
  high: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-red-500/10 text-red-500",
};

interface ImageItem { id: string; src: string; base64: string; mime: string }

export function ImportFromImage({ open, onClose, onImport }: Props) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [step, setStep] = useState<"upload" | "extracting" | "fetching-prices" | "review">("upload");
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importCash, setImportCash] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setImages([]);
      setStep("upload");
      setExtracted(null);
      setError(null);
      setIsImporting(false);
    }
  }, [open]);

  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      setImages((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, src: dataUrl, base64, mime: file.type || "image/png" },
      ]);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function loadFiles(fileList: FileList | File[]) {
    Array.from(fileList).forEach((f) => {
      if (f.type.startsWith("image/")) loadFile(f);
    });
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    loadFiles(e.dataTransfer.files);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) loadFiles(e.target.files);
    e.target.value = "";
  };

  // Global paste listener — supports multiple pasted images
  useEffect(() => {
    if (!open) return;
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? []).filter((i) => i.type.startsWith("image/"));
      if (items.length) {
        items.forEach((item) => {
          const file = item.getAsFile();
          if (file) loadFile(file);
        });
        toast.info(`${items.length} image${items.length > 1 ? "s" : ""} pasted from clipboard`);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]);

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function extract() {
    if (!images.length) return;
    setStep("extracting");
    setError(null);
    try {
      const res = await fetch("/api/gemini/extract-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((img) => ({ imageData: img.base64, mimeType: img.mime })),
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Extraction failed");

      // Filter out qty=0 rows (watchlist, not holdings). Keep avg_price from Gemini if provided.
      const validHoldings = ((j.data.holdings ?? []) as ExtractedHolding[])
        .filter((h) => h.symbol && Number(h.qty) > 0)
        .map((h) => ({
          ...h,
          avg_price: h.avg_price != null && Number(h.avg_price) > 0 ? Number(h.avg_price) : null,
          current_price: null,
          _import: true,
        }));

      if (!validHoldings.length) {
        throw new Error("No holdings with quantity > 0 found in the image(s)");
      }

      // Fetch live prices from CSE API — never trust the image for current price.
      setStep("fetching-prices");
      const priceMap = await fetchLivePrices(validHoldings.map((h) => h.symbol));

      const withPrices = validHoldings.map((h) => {
        const livePrice = priceMap.get(h.symbol.toUpperCase()) ?? null;
        return {
          ...h,
          current_price: livePrice,
          // Prefer Gemini-extracted avg_price; fall back to live price only if image didn't show it.
          avg_price: h.avg_price ?? livePrice,
        };
      });

      const data: ExtractedData = {
        ...j.data,
        holdings: withPrices,
      };
      setExtracted(data);
      setStep("review");
    } catch (err) {
      setError(String(err));
      setStep("upload");
    }
  }

  async function fetchLivePrices(symbols: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    // Use companyInfoSummery per symbol — it works for every listed stock,
    // whereas todaySharePrice only returns a handful of recent trades.
    const results = await Promise.allSettled(
      symbols.map(async (sym) => {
        const res = await fetch("/api/cse/companyInfoSummery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: sym }),
        });
        const j = await res.json();
        const info = (j.data?.reqSymbolInfo ?? j.data) as Record<string, unknown> | undefined;
        const price = Number(info?.lastTradedPrice ?? info?.closingPrice ?? info?.previousClose ?? 0);
        return { sym: sym.toUpperCase(), price };
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.price > 0) {
        map.set(r.value.sym, r.value.price);
      }
    }
    return map;
  }

  function toggleRow(i: number) {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      holdings: extracted.holdings.map((h, idx) =>
        idx === i ? { ...h, _import: !h._import } : h
      ),
    });
  }

  function updateField(i: number, field: keyof ExtractedHolding, value: string | number) {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      holdings: extracted.holdings.map((h, idx) =>
        idx === i ? { ...h, [field]: value } : h
      ),
    });
  }

  async function doImport() {
    if (!extracted) return;
    const rows = extracted.holdings
      .filter((h) => h._import && h.symbol && h.qty > 0)
      .map((h) => ({
        symbol: h.symbol.toUpperCase().trim(),
        company_name: h.company_name ?? null,
        qty: Number(h.qty),
        avg_price: Number(h.avg_price ?? h.current_price ?? 0),
      }))
      .filter((h) => h.avg_price > 0);

    if (!rows.length) {
      toast.error("No valid holdings to import");
      return;
    }

    const cash = importCash && extracted.cash_balance ? extracted.cash_balance : undefined;
    try {
      setIsImporting(true);
      await onImport(rows, cash);
      onClose();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsImporting(false);
    }
  }

  const selectedCount = extracted?.holdings.filter((h) => h._import).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Import from Screenshot
          </DialogTitle>
          <DialogDescription>
            Paste or upload a screenshot of your trading account. Gemini will extract your holdings automatically.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={cn(
                "relative border-2 border-dashed rounded-xl transition-colors",
                images.length ? "border-primary/40 bg-primary/5 p-3" : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
            >
              {images.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map((img, idx) => (
                      <div key={img.id} className="relative group rounded-lg overflow-hidden border bg-background">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.src} alt={`Screenshot ${idx + 1}`} className="w-full h-28 object-cover" />
                        <div className="absolute top-1 left-1 text-[10px] font-semibold bg-background/90 px-1.5 rounded">#{idx + 1}</div>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(img.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <label className="flex flex-col items-center justify-center gap-1 h-28 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer">
                      <Plus className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Add more</span>
                      <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFileInput} />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {images.length} image{images.length > 1 ? "s" : ""} ready — paste more with <kbd className="px-1 rounded bg-muted border">Ctrl+V</kbd>
                  </p>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-3 py-10 cursor-pointer">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop images here or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Multiple images supported. Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">Ctrl+V</kbd> to paste
                    </p>
                  </div>
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFileInput} />
                </label>
              )}
            </div>

            {/* Paste hint */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <ClipboardPaste className="h-3.5 w-3.5 shrink-0" />
              Tip: Scroll through your broker app and paste multiple screenshots — Gemini will merge all holdings.
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" disabled={!images.length} onClick={extract}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Extract {images.length > 1 ? `${images.length} images` : ""} with Gemini
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Extracting ── */}
        {step === "extracting" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium">Gemini is reading your screenshots...</p>
              <p className="text-sm text-muted-foreground mt-1">Extracting symbols and quantities</p>
            </div>
            <Progress value={null} className="w-48 animate-pulse" />
          </div>
        )}

        {/* ── Step 2b: Fetching live prices ── */}
        {step === "fetching-prices" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium">Fetching live prices from CSE...</p>
              <p className="text-sm text-muted-foreground mt-1">Looking up current market prices for each symbol</p>
            </div>
            <Progress value={null} className="w-48 animate-pulse" />
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === "review" && extracted && (
          <div className="space-y-4">
            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              {extracted.broker && (
                <Badge variant="outline" className="text-xs">{extracted.broker}</Badge>
              )}
              <Badge className={cn("text-xs", CONFIDENCE_STYLE[extracted.confidence])} variant="secondary">
                {extracted.confidence === "high" ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                {extracted.confidence} confidence
              </Badge>
              {extracted.total_portfolio_value && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Total detected: {formatLKR(extracted.total_portfolio_value, true)}
                </span>
              )}
            </div>

            {extracted.confidence !== "high" && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Some values may be inaccurate. Please review each row before importing.
              </div>
            )}

            {/* Holdings table */}
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_80px_90px_90px_32px] gap-px bg-border text-xs font-medium text-muted-foreground">
                {["", "Symbol / Name", "Qty", "Avg Price", "Curr. Price", ""].map((h, i) => (
                  <div key={i} className="bg-muted/50 px-2 py-2">{h}</div>
                ))}
              </div>
              {extracted.holdings.map((h, i) => (
                <div
                  key={i}
                  className={cn(
                    "grid grid-cols-[auto_1fr_80px_90px_90px_32px] gap-px bg-border",
                    !h._import && "opacity-40"
                  )}
                >
                  <div className="bg-background px-2 py-1.5 flex items-center">
                    <input
                      type="checkbox"
                      checked={h._import}
                      onChange={() => toggleRow(i)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                  </div>
                  <div className="bg-background px-2 py-1">
                    <Input
                      value={h.symbol}
                      onChange={(e) => updateField(i, "symbol", e.target.value.toUpperCase())}
                      className="h-6 text-xs font-mono px-1 font-semibold"
                    />
                    {h.company_name && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{h.company_name}</p>
                    )}
                  </div>
                  <div className="bg-background px-1 py-1">
                    <Input
                      type="number"
                      value={h.qty}
                      onChange={(e) => updateField(i, "qty", parseInt(e.target.value) || 0)}
                      className="h-6 text-xs px-1"
                    />
                  </div>
                  <div className="bg-background px-1 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={h.avg_price ?? ""}
                      placeholder="—"
                      onChange={(e) => updateField(i, "avg_price", parseFloat(e.target.value) || 0)}
                      className="h-6 text-xs px-1"
                    />
                  </div>
                  <div className="bg-background px-1 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={h.current_price ?? ""}
                      placeholder="—"
                      onChange={(e) => updateField(i, "current_price", parseFloat(e.target.value) || 0)}
                      className="h-6 text-xs px-1"
                    />
                  </div>
                  <div className="bg-background flex items-center justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => setExtracted({
                        ...extracted,
                        holdings: extracted.holdings.filter((_, idx) => idx !== i),
                      })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cash option */}
            {extracted.cash_balance && (
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                  importCash ? "border-primary bg-primary/5" : "border-border"
                )}
                onClick={() => setImportCash(!importCash)}
              >
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={importCash} onChange={() => setImportCash(!importCash)} className="accent-primary" />
                  <span className="text-sm">Also set cash balance</span>
                </div>
                <span className="text-sm font-medium">{formatLKR(extracted.cash_balance)}</span>
              </div>
            )}

            <Separator />

            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              This will <strong>replace</strong> your entire portfolio with the holdings shown above. Existing holdings will be removed.
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setStep("upload"); setExtracted(null); setImages([]); }}>
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
