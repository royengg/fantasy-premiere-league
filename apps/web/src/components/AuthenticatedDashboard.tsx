import { useState } from "react";
import { Package, Target, Trophy, Users } from "lucide-react";

import type { BuildRosterInput, DashboardPayload } from "@fantasy-cricket/types";

import { ContestView } from "./ContestView";
import { DashboardHome } from "./DashboardHome";
import { LeagueView } from "./LeagueView";
import { LockerView } from "./LockerView";
import { PredictionView } from "./PredictionView";
import { Sidebar } from "./Sidebar";

export type Screen = "home" | "contests" | "leagues" | "predictions" | "locker";

interface AuthenticatedDashboardProps {
  dashboard: DashboardPayload;
  onLogout: () => Promise<void>;
  onSubmitRoster: (contestId: string, payload: BuildRosterInput) => Promise<unknown>;
  onCreateLeague: (payload: {
    name: string;
    description?: string;
    visibility: "public" | "private";
  }) => Promise<unknown>;
  onJoinLeague: (inviteCode: string) => Promise<unknown>;
  onAnswerPrediction: (questionId: string, optionId: string) => Promise<unknown>;
  onEquipCosmetic: (cosmeticId: string) => Promise<unknown>;
}

export function AuthenticatedDashboard({
  dashboard,
  onLogout,
  onSubmitRoster,
  onCreateLeague,
  onJoinLeague,
  onAnswerPrediction,
  onEquipCosmetic
}: AuthenticatedDashboardProps) {
  const [screen, setScreen] = useState<Screen>("home");

  const navItems = [
    {
      id: "contests" as const,
      title: "Contests",
      subtitle: "Select your playing XI",
      icon: Users,
      stats: { value: dashboard.contests.length, label: "Live Matches" }
    },
    {
      id: "leagues" as const,
      title: "Leagues",
      subtitle: "Compete with friends",
      icon: Trophy,
      stats: { value: dashboard.leagues.length, label: "Active" }
    },
    {
      id: "predictions" as const,
      title: "Predictions",
      subtitle: "Predict match outcomes",
      icon: Target,
      stats: { value: dashboard.profile.streak, label: "Day Streak" }
    },
    {
      id: "locker" as const,
      title: "Locker",
      subtitle: "Your achievements",
      icon: Package,
      stats: { value: dashboard.inventory.cosmeticIds.length, label: "Items" }
    }
  ];

  const renderScreen = () => {
    switch (screen) {
      case "contests":
        return (
          <ContestView
            contests={dashboard.contests}
            matches={dashboard.matches}
            teams={dashboard.teams}
            players={dashboard.players}
            rosters={dashboard.rosters}
            leaderboard={dashboard.leaderboard}
            profileCredits={dashboard.profile.credits}
            userId={dashboard.user.id}
            onSubmit={onSubmitRoster}
          />
        );
      case "leagues":
        return (
          <LeagueView
            leagues={dashboard.leagues}
            onCreate={onCreateLeague}
            onJoin={onJoinLeague}
          />
        );
      case "predictions":
        return (
          <PredictionView
            questions={dashboard.questions}
            answers={dashboard.answers}
            streak={dashboard.profile.streak}
            teams={dashboard.teams}
            onAnswer={onAnswerPrediction}
          />
        );
      case "locker":
        return (
          <LockerView
            inventory={dashboard.inventory}
            cosmetics={dashboard.cosmetics}
            badges={dashboard.badges}
            profile={dashboard.profile}
            onEquip={onEquipCosmetic}
          />
        );
      case "home":
      default:
        return (
          <DashboardHome
            dashboard={dashboard}
            navItems={navItems}
            onNavigate={setScreen}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar
        currentScreen={screen}
        onNavigate={(nextScreen) => setScreen(nextScreen as Screen)}
        onLogout={onLogout}
      />

      <main className="ml-16 lg:ml-64 min-h-screen bg-grid bg-radial">
        {screen === "home" ? renderScreen() : <div className="p-6 lg:p-8">{renderScreen()}</div>}
      </main>
    </div>
  );
}
