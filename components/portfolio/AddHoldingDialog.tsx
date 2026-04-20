"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EnrichedHolding } from "@/lib/portfolio/calc";

const schema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  company_name: z.string().optional(),
  qty: z.coerce.number().positive(),
  avg_price: z.coerce.number().positive(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormValues) => void;
  editing?: EnrichedHolding | null;
}

export function AddHoldingDialog({ open, onClose, onSave, editing }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) as Resolver<FormValues> });

  useEffect(() => {
    if (editing) {
      reset({
        symbol: editing.symbol,
        company_name: editing.company_name ?? "",
        qty: editing.qty,
        avg_price: editing.avg_price,
        notes: editing.notes ?? "",
      });
    } else {
      reset({ symbol: "", company_name: "", qty: undefined, avg_price: undefined, notes: "" });
    }
  }, [editing, reset]);

  function onSubmit(data: FormValues) {
    onSave(data);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Holding" : "Add Holding"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="symbol">Symbol *</Label>
              <Input id="symbol" placeholder="COMB" {...register("symbol")} />
              {errors.symbol && <p className="text-xs text-destructive">{errors.symbol.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="company_name">Company Name</Label>
              <Input id="company_name" placeholder="Commercial Bank" {...register("company_name")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="qty">Quantity *</Label>
              <Input id="qty" type="number" step="1" placeholder="1000" {...register("qty")} />
              {errors.qty && <p className="text-xs text-destructive">{errors.qty.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="avg_price">Avg Price (LKR) *</Label>
              <Input id="avg_price" type="number" step="0.01" placeholder="85.50" {...register("avg_price")} />
              {errors.avg_price && <p className="text-xs text-destructive">{errors.avg_price.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Optional notes..." rows={2} {...register("notes")} />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {editing ? "Update" : "Add Holding"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
