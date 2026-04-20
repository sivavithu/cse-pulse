"use client";

import { useCallback, useState } from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import type { ThemeValue } from "@/lib/theme";
import { isThemeValue } from "@/lib/theme";

export function useThemePreference() {
  const { data: session, status } = useSession();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isSaving, setIsSaving] = useState(false);

  const activeTheme: ThemeValue = isThemeValue(theme) ? theme : "system";

  const updateTheme = useCallback(
    async (nextTheme: ThemeValue) => {
      setTheme(nextTheme);

      if (status !== "authenticated" || !session?.user?.email) {
        return true;
      }

      setIsSaving(true);
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: nextTheme }),
        });
        return res.ok;
      } finally {
        setIsSaving(false);
      }
    },
    [session?.user?.email, setTheme, status]
  );

  return {
    theme: activeTheme,
    resolvedTheme,
    updateTheme,
    isSaving,
  };
}
