"use client";

import { useEffect, useState } from "react";
import { Bot, Laptop, Menu, Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemePreference } from "@/lib/hooks/useThemePreference";
import type { ThemeValue } from "@/lib/theme";
import { useUiStore } from "@/store/ui";
import { getActiveNav } from "./nav";

const THEME_OPTIONS: Array<{
  value: ThemeValue;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", description: "Paper trading desk", icon: Sun },
  { value: "dark", label: "Dark", description: "Night session view", icon: Moon },
  { value: "system", label: "System", description: "Follow device preference", icon: Laptop },
];

export function TopNav() {
  const pathname = usePathname();
  const active = getActiveNav(pathname);
  const { theme, resolvedTheme, updateTheme, isSaving } = useThemePreference();
  const { setSidebarOpen, toggleChat, fallbackActive } = useUiStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ThemeIcon = !mounted ? Laptop : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/72 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <Button
          variant="outline"
          size="icon-sm"
          className="md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <p className="eyebrow">Workspace</p>
          <div className="flex items-center gap-3">
            <h2 className="truncate font-heading text-xl font-semibold">{active.label}</h2>
            {fallbackActive ? (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                Fallback scraping active
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">{active.caption}</p>
        </div>

        {isSaving ? (
          <Badge variant="outline" className="hidden md:inline-flex">
            Saving theme
          </Badge>
        ) : null}

        <Button
          variant="outline"
          size="icon-sm"
          onClick={toggleChat}
          title="Open AI assistant"
          aria-label="Open AI assistant"
        >
          <Bot className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon-sm" className="relative" />}
          >
            <ThemeIcon className="h-4 w-4" />
            <span className="sr-only">Change theme</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            {THEME_OPTIONS.map(({ value, label, description, icon: Icon }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => {
                  void updateTheme(value);
                }}
                className={mounted && theme === value ? "bg-accent/70" : undefined}
              >
                <Icon className="h-4 w-4" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{label}</span>
                  <span className="truncate text-xs text-muted-foreground">{description}</span>
                </div>
                {mounted && theme === value ? (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Active
                  </span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
