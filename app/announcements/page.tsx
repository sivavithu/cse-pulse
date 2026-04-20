"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { useAnnouncementFeed } from "@/lib/hooks/useMarket";
import { usePortfolio } from "@/lib/hooks/usePortfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeAnnouncement } from "@/lib/cse/normalize";
import type { Announcement, AnnouncementCategory } from "@/lib/cse/types";
import { Bell } from "lucide-react";

type AnnouncementTab = "all" | "other" | Exclude<AnnouncementCategory, "corporate" | "other">;

const TABS: Array<{ label: string; value: AnnouncementTab }> = [
  { label: "All", value: "all" },
  { label: "Rights", value: "rights" },
  { label: "Dividend", value: "dividend" },
  { label: "Financial", value: "financial" },
  { label: "Listings", value: "listing" },
  { label: "Circulars", value: "circular" },
  { label: "Other", value: "other" },
];

function AnnouncementList({
  announcements,
  isLoading,
  error,
  userHoldings,
}: {
  announcements: Announcement[];
  isLoading: boolean;
  error: unknown;
  userHoldings: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-muted-foreground py-4">Failed to load announcements. Try enabling fallback in Settings.</p>;
  }

  if (!announcements.length) {
    return <p className="text-sm text-muted-foreground py-4">No announcements found.</p>;
  }

  return (
    <div className="space-y-3">
      {announcements.map((announcement) => (
        <AnnouncementCard
          key={`${announcement.id}:${announcement.subject}`}
          announcement={announcement}
          userHoldings={userHoldings}
        />
      ))}
    </div>
  );
}

export default function AnnouncementsPage() {
  const { data: portfolio } = usePortfolio();
  const { data: raw = [], isLoading, error } = useAnnouncementFeed();
  const [tab, setTab] = useState<AnnouncementTab>("all");

  const userHoldings = portfolio?.holdings
    .map((h) => `${h.symbol}: ${h.qty} shares @ avg LKR${h.avg_price}`)
    .join(", ") ?? "";

  const announcements = useMemo(() => {
    const normalized = (raw as Record<string, unknown>[])
      .map(normalizeAnnouncement)
      .filter((announcement) => announcement.subject || announcement.companyName);

    const deduped = Array.from(
      new Map(normalized.map((announcement) => [`${announcement.id}:${announcement.subject}`, announcement])).values()
    );

    const sorted = deduped.sort((a, b) => {
      const at = Date.parse(a.date);
      const bt = Date.parse(b.date);
      if (!Number.isNaN(at) && !Number.isNaN(bt)) return bt - at;
      return b.date.localeCompare(a.date);
    });

    if (tab === "all") return sorted;
    if (tab === "other") {
      return sorted.filter((announcement) => announcement.category === "other" || announcement.category === "corporate");
    }
    return sorted.filter((announcement) => announcement.category === tab);
  }, [raw, tab]);

  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="max-w-3xl">
          <p className="eyebrow">Filings Feed</p>
          <h1 className="hero-title">Announcements</h1>
          <p className="hero-copy">
            Review new filings, dividend notices, circulars, and listings in a single filtered feed.
          </p>
        </div>
        <div className="panel-muted flex items-center gap-2 text-xs">
          <Bell className="h-3.5 w-3.5 text-primary" />
          AI explanations stay available inside each card.
        </div>
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(value as AnnouncementTab)}>
        <TabsList variant="line" className="gap-2">
          {TABS.map((tabItem) => (
            <TabsTrigger key={tabItem.value} value={tabItem.value} className="text-xs">
              {tabItem.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-4">
          <AnnouncementList
            announcements={announcements}
            isLoading={isLoading}
            error={error}
            userHoldings={userHoldings}
          />
        </div>
      </Tabs>
    </div>
  );
}
