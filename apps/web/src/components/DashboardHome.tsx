import type { LucideIcon } from "lucide-react";

import type { HomePagePayload } from "@fantasy-cricket/types";

import type { DashboardRoute } from "../lib/dashboard-routes";
import { LiveMatchCarousel } from "./LiveMatchCarousel";
import { NavigationCard } from "./NavigationCard";

interface DashboardHomeProps {
  dashboard: HomePagePayload;
  navItems: Array<{
    id: DashboardRoute;
    title: string;
    subtitle: string;
    icon: LucideIcon;
    stats: { value: number; label: string };
  }>;
  onNavigate: (screen: DashboardRoute) => void;
}

export function DashboardHome({ dashboard, navItems, onNavigate }: DashboardHomeProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-1.5 sm:px-6 sm:py-3 lg:px-8 lg:py-6">
      <header className="mb-3 sm:mb-5 lg:mb-6">
        <div className="flex items-start justify-between gap-3 sm:items-center">
          <div>
            <p className="text-accent mb-1.5 text-[10px] font-bold uppercase tracking-widest sm:mb-2 sm:text-xs">IPL 2026</p>
            <h1 className="mb-1 text-lg font-extrabold tracking-tight sm:mb-2 sm:text-3xl lg:text-4xl">
              Hey, {dashboard.profile.username.split(" ")[0]}
            </h1>
            <p className="text-sm text-text-muted sm:text-base">What are you playing today?</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:gap-3 sm:self-auto">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{dashboard.profile.username}</p>
              <p className="text-xs text-text-muted">Level {dashboard.profile.level}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-accent/20 text-sm font-bold text-accent sm:h-10 sm:w-10">
              {dashboard.profile.username.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <LiveMatchCarousel
        contests={dashboard.contests}
        matches={dashboard.matches}
        teams={dashboard.teams}
        onOpenContests={() => onNavigate("contests")}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-8">
        {navItems.map((item) => (
          <NavigationCard
            key={item.id}
            {...item}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
