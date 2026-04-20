"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";

interface Props {
  symbol: string;
  height?: number;
}

export function TradingViewChart({ symbol, height = 460 }: Props) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  const src = useMemo(() => {
    const params = new URLSearchParams({
      symbol: `CSELK:${symbol.toUpperCase()}`,
      interval: "D",
      hidesidetoolbar: "1",
      symboledit: "1",
      saveimage: "1",
      toolbarbg: theme === "dark" ? "111827" : "f8fafc",
      theme,
      style: "3",
      timezone: "Asia/Colombo",
      withdateranges: "1",
      hideideas: "1",
      studies: "[]",
    });

    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [symbol, theme]);

  return (
    <iframe
      key={src}
      title={`${symbol} chart`}
      src={src}
      className="w-full rounded-lg border bg-background"
      style={{ height }}
      loading="lazy"
    />
  );
}
