"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { StockQuickViewDialog } from "@/components/stocks/StockQuickViewDialog";

interface Props {
  symbol: string;
  children: ReactNode;
  className?: string;
}

export function StockQuickViewTrigger({ symbol, children, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn(className)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open ? <StockQuickViewDialog open={open} onOpenChange={setOpen} symbol={symbol} /> : null}
    </>
  );
}
