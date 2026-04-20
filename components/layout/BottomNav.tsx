"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/88 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-2xl md:hidden">
      <div className="grid grid-cols-5 gap-2 rounded-[28px] border border-border/70 bg-card/85 p-2 shadow-[0_20px_60px_-34px_rgba(15,23,42,0.6)]">
        {NAV_ITEMS.slice(0, 5).map(({ href, shortLabel, icon: Icon }) => {
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-2 transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-[0_16px_32px_-22px_hsl(var(--primary)/0.8)]"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "stroke-[2.3]")} />
              <span className="text-[10px] font-semibold">{shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
