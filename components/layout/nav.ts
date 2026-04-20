import {
  Bell,
  BriefcaseBusiness,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Star,
  TrendingUp,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  caption: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    caption: "Market pulse and session context",
    icon: LayoutDashboard,
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    shortLabel: "Portfolio",
    caption: "Positions, P and L, and allocation",
    icon: BriefcaseBusiness,
  },
  {
    href: "/stocks",
    label: "Stocks",
    shortLabel: "Stocks",
    caption: "Quotes, movers, and quick drilldowns",
    icon: TrendingUp,
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    shortLabel: "Watch",
    caption: "Thresholds, alerts, and monitored names",
    icon: Star,
  },
  {
    href: "/announcements",
    label: "Announcements",
    shortLabel: "News",
    caption: "Filings, circulars, and company actions",
    icon: Bell,
  },
  {
    href: "/settings",
    label: "Settings",
    shortLabel: "Settings",
    caption: "Profile preferences and automation",
    icon: Settings,
  },
];

export function getActiveNav(pathname: string): NavItem {
  return NAV_ITEMS.find((item) => pathname.startsWith(item.href)) ?? NAV_ITEMS[0];
}
