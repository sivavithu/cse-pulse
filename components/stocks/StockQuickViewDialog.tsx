"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StockOverview } from "@/components/stocks/StockOverview";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
}

export function StockQuickViewDialog({ open, onOpenChange, symbol }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl w-[min(96vw,1100px)] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock Quick View</DialogTitle>
          <DialogDescription>
            Price overview and interactive chart for {symbol.toUpperCase()}.
          </DialogDescription>
        </DialogHeader>
        <StockOverview symbol={symbol} compact />
      </DialogContent>
    </Dialog>
  );
}
