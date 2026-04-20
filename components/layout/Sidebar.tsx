"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { TrendingUp, X, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";
import { getActiveNav, NAV_ITEMS } from "./nav";

function NavLinks({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 px-3 py-4">
      {NAV_ITEMS.map(({ href, label, caption, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-200",
              active
                ? "bg-card/95 dark:bg-card text-foreground shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)] dark:shadow-[0_4px_16px_-6px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-primary/25 dark:ring-primary/35"
                : "text-muted-foreground hover:bg-card/60 dark:hover:bg-sidebar-accent hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                active
                  ? "border-primary/30 dark:border-primary/40 bg-primary/12 dark:bg-primary/15 text-primary"
                  : "border-border/60 dark:border-border/80 bg-background/60 dark:bg-white/[0.04] text-muted-foreground group-hover:border-primary/25 dark:group-hover:border-primary/35 group-hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{caption}</p>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function UserProfile() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const active = getActiveNav(pathname);

  if (!session?.user) return null;

  const { name, email, image } = session.user;

  return (
    <div className="rounded-[24px] border border-border/70 dark:border-border/80 bg-card/85 dark:bg-card p-3 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)] dark:shadow-[0_8px_24px_-10px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-3">
        {image ? (
          <Image
            src={image}
            alt={name ?? ""}
            width={38}
            height={38}
            className="rounded-2xl ring-1 ring-border/70"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/15">
            {name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-border/60 dark:border-border/75 bg-background/70 dark:bg-white/[0.04] px-3 py-2">
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Current Desk</p>
        <p className="mt-1 text-sm font-semibold">{active.label}</p>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() => void signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/60 dark:border-border/90 bg-background/55 dark:bg-sidebar backdrop-blur-2xl md:flex md:flex-col">
      <div className="border-b border-border/60 px-5 pb-4 pt-5">
        <p className="eyebrow">Colombo Market Desk</p>
        <div className="mt-3 flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[20px] border border-primary/20 bg-primary/10 text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold">CSE Pulse</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track holdings, alerts, and the broader tape in one workspace.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <NavLinks />
      </div>

      <div className="p-3">
        <UserProfile />
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-[20rem] border-r border-border/70 bg-background/92 p-0 backdrop-blur-2xl"
      >
        <div className="border-b border-border/60 px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-[18px] border border-primary/20 bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="eyebrow">Colombo Market Desk</p>
                <h2 className="font-heading text-lg font-semibold">CSE Pulse</h2>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <NavLinks onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="p-3">
          <UserProfile />
        </div>
      </SheetContent>
    </Sheet>
  );
}
