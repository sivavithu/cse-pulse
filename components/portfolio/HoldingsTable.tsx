"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import type { EnrichedHolding } from "@/lib/portfolio/calc";
import { formatLKR, formatPct, plBg, plColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { StockQuickViewTrigger } from "@/components/stocks/StockQuickViewTrigger";

interface Props {
  holdings: EnrichedHolding[];
  onEdit: (h: EnrichedHolding) => void;
  onDelete: (id: number) => void;
}

export function HoldingsTable({ holdings, onEdit, onDelete }: Props) {
  if (!holdings.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No holdings yet. Add your first stock!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Avg Price</TableHead>
            <TableHead className="text-right">LTP</TableHead>
            <TableHead className="text-right">Market Value</TableHead>
            <TableHead className="text-right">Net P&amp;L</TableHead>
            <TableHead className="text-right">Net P&amp;L %</TableHead>
            <TableHead className="text-right">Day</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((h) => (
            <TableRow key={h.id}>
              <TableCell>
                <div>
                  <StockQuickViewTrigger symbol={h.symbol} className="font-medium hover:text-primary transition-colors">
                    {h.symbol}
                  </StockQuickViewTrigger>
                  {h.company_name && (
                    <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {h.company_name}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">{h.qty.toLocaleString()}</TableCell>
              <TableCell className="text-right">{formatLKR(h.avg_price)}</TableCell>
              <TableCell className="text-right">
                {h.ltp > 0 ? formatLKR(h.ltp) : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-right font-medium">
                {h.ltp > 0 ? formatLKR(h.marketValue, true) : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className={cn("text-right font-medium", plColor(h.pl))}>
                {h.ltp > 0 ? formatLKR(h.pl, true) : "—"}
              </TableCell>
              <TableCell className="text-right">
                {h.ltp > 0 ? (
                  <Badge className={plBg(h.pl)} variant="secondary">
                    {formatPct(h.plPct)}
                  </Badge>
                ) : "—"}
              </TableCell>
              <TableCell className="text-right">
                {h.ltp > 0 ? (
                  <Badge className={plBg(h.dayChange)} variant="secondary">
                    {formatPct(h.dayChangePct)}
                  </Badge>
                ) : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 justify-end">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(h)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(h.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
