import { Crown, Flame, Star, Wallet, type LucideIcon } from "lucide-react";

import type { DashboardPayload } from "@fantasy-cricket/types";

import { LiveMatchCarousel } from "./LiveMatchCarousel";
import { NavigationCard } from "./NavigationCard";

type Screen = "home" | "contests" | "leagues" | "predictions" | "locker";

interface DashboardHomeProps {
  dashboard: DashboardPayload;
  navItems: Array<{
    id: Screen;
    title: string;
    subtitle: string;
    icon: LucideIcon;
    stats: { value: number; label: string };
  }>;
  onNavigate: (screen: Screen) => void;
}

export function DashboardHome({ dashboard, navItems, onNavigate }: DashboardHomeProps) {
  return (
    <div className="p-6 lg:p-8">
      <header className="mb-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-accent text-xs font-bold uppercase tracking-widest mb-2">IPL 2026</p>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-2">
              Hey, {dashboard.profile.username.split(" ")[0]}
            </h1>
            <p className="text-text-muted">What are you playing today?</p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold">{dashboard.profile.username}</p>
              <p className="text-xs text-text-muted">Level {dashboard.profile.level}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-sm font-bold text-accent">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="stat-block">
          <Wallet className="w-5 h-5 text-accent mb-2" />
          <span className="stat-value">{dashboard.profile.credits.toFixed(1)}</span>
          <span className="stat-label">Credits</span>
        </div>
        <div className="stat-block">
          <Star className="w-5 h-5 text-accent mb-2" />
          <span className="stat-value text-accent">{dashboard.profile.xp.toLocaleString()}</span>
          <span className="stat-label">Total XP</span>
        </div>
        <div className="stat-block">
          <Flame className="w-5 h-5 text-accent mb-2" />
          <span className="stat-value">{dashboard.profile.streak}</span>
          <span className="stat-label">Day Streak</span>
        </div>
        <div className="stat-block">
          <Crown className="w-5 h-5 text-accent mb-2" />
          <span className="stat-value">Lv.{dashboard.profile.level}</span>
          <span className="stat-label">Level</span>
        </div>
      </div>
    </div>
  );
}
