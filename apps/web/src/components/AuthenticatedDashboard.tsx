import { useQuery } from "@tanstack/react-query";
import { Package, Target, Trophy, Users } from "lucide-react";
import { createApiClient } from "@fantasy-cricket/api-client";

import type {
  BootstrapPayload,
  BuildRosterInput,
  League
} from "@fantasy-cricket/types";

import { useDashboardRoute } from "../hooks/use-dashboard-route";
import { ContestView } from "./ContestView";
import { DashboardHome } from "./DashboardHome";
import { LeagueLobbyView } from "./LeagueLobbyView";
import { LeagueView } from "./LeagueView";
import { LockerView } from "./LockerView";
import { PredictionView } from "./PredictionView";
import { Sidebar } from "./Sidebar";

type ApiClient = ReturnType<typeof createApiClient>;

interface AuthenticatedDashboardProps {
  bootstrap: BootstrapPayload;
  api: ApiClient;
  onLogout: () => Promise<void>;
  onSubmitRoster: (contestId: string, payload: BuildRosterInput) => Promise<unknown>;
  onCreateLeague: (payload: {
    name: string;
    description?: string;
    visibility: "public" | "private";
    maxMembers: number;
  }) => Promise<League>;
  onJoinLeague: (inviteCode: string) => Promise<League>;
  onAnswerPrediction: (questionId: string, optionId: string) => Promise<unknown>;
  onEquipCosmetic: (cosmeticId: string) => Promise<unknown>;
}

export function AuthenticatedDashboard({
  bootstrap,
  api,
  onLogout,
  onSubmitRoster,
  onCreateLeague,
  onJoinLeague,
  onAnswerPrediction,
  onEquipCosmetic
}: AuthenticatedDashboardProps) {
  const { route, leagueId, navigate, navigateToLeague } = useDashboardRoute();
  const homeQuery = useQuery({
    queryKey: ["home"],
    queryFn: () => api.getHome(),
    enabled: route === "home"
  });

  const contestsQuery = useQuery({
    queryKey: ["contests"],
    queryFn: () => api.getContestsPage(),
    enabled: route === "contests"
  });

  const leaguesQuery = useQuery({
    queryKey: ["leagues"],
    queryFn: () => api.getLeagues(),
    enabled: route === "leagues"
  });

  const predictionsQuery = useQuery({
    queryKey: ["predictions"],
    queryFn: () => api.getPredictionsPage(),
    enabled: route === "predictions"
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.getInventoryPage(),
    enabled: route === "locker"
  });

  const renderScreen = () => {
    switch (route) {
      case "contests":
        if (contestsQuery.isLoading) {
          return <PageLoading message="Loading contests..." />;
        }

        if (contestsQuery.isError || !contestsQuery.data) {
          return <PageError message={(contestsQuery.error as Error)?.message ?? "Could not load contests."} />;
        }

        return (
          <ContestView
            contests={contestsQuery.data.contests}
            matches={contestsQuery.data.matches}
            teams={contestsQuery.data.teams}
            players={contestsQuery.data.players}
            rosters={contestsQuery.data.rosters}
            leaderboard={contestsQuery.data.leaderboard}
            userId={bootstrap.user.id}
            onSubmit={onSubmitRoster}
          />
        );
      case "leagues":
        if (leaguesQuery.isLoading) {
          return <PageLoading message="Loading leagues..." />;
        }

        if (leaguesQuery.isError || !leaguesQuery.data) {
          return <PageError message={(leaguesQuery.error as Error)?.message ?? "Could not load leagues."} />;
        }

        if (leagueId) {
          const league = leaguesQuery.data.find((entry) => entry.id === leagueId);
          if (!league) {
            if (leaguesQuery.isFetching) {
              return <PageLoading message="Opening league..." />;
            }
            return <PageError message="League not found." />;
          }

          return (
            <LeagueLobbyView
              api={api}
              currentUserId={bootstrap.user.id}
              league={league}
              onBack={() => navigate("leagues")}
            />
          );
        }

        return (
          <LeagueView
            currentUserId={bootstrap.user.id}
            leagues={leaguesQuery.data}
            onCreate={onCreateLeague}
            onJoin={onJoinLeague}
            onOpenLeague={navigateToLeague}
          />
        );
      case "predictions":
        if (predictionsQuery.isLoading) {
          return <PageLoading message="Loading predictions..." />;
        }

        if (predictionsQuery.isError || !predictionsQuery.data) {
          return <PageError message={(predictionsQuery.error as Error)?.message ?? "Could not load predictions."} />;
        }

        return (
          <PredictionView
            questions={predictionsQuery.data.questions}
            answers={predictionsQuery.data.answers}
            streak={predictionsQuery.data.profile.streak}
            teams={predictionsQuery.data.teams}
            onAnswer={onAnswerPrediction}
          />
        );
      case "locker":
        if (inventoryQuery.isLoading) {
          return <PageLoading message="Loading locker..." />;
        }

        if (inventoryQuery.isError || !inventoryQuery.data) {
          return <PageError message={(inventoryQuery.error as Error)?.message ?? "Could not load locker."} />;
        }

        return (
          <LockerView
            inventory={inventoryQuery.data.inventory}
            cosmetics={inventoryQuery.data.cosmetics}
            badges={inventoryQuery.data.badges}
            profile={inventoryQuery.data.profile}
            onEquip={onEquipCosmetic}
          />
        );
      case "home":
      default:
        if (homeQuery.isLoading) {
          return <PageLoading message="Loading home..." />;
        }

        if (homeQuery.isError || !homeQuery.data) {
          return <PageError message={(homeQuery.error as Error)?.message ?? "Could not load home."} />;
        }

        return (
          <DashboardHome
            dashboard={homeQuery.data}
            navItems={[
              {
                id: "contests" as const,
                title: "Contests",
                subtitle: "Build your 11 + 2 for every match",
                icon: Users,
                stats: { value: homeQuery.data.contests.length, label: "Live Matches" }
              },
              {
                id: "leagues" as const,
                title: "Leagues",
                subtitle: "Season-long squads and league auctions",
                icon: Trophy,
                stats: { value: homeQuery.data.leagueCount, label: "Active" }
              },
              {
                id: "predictions" as const,
                title: "Predictions",
                subtitle: "Predict match outcomes",
                icon: Target,
                stats: { value: homeQuery.data.profile.streak, label: "Day Streak" }
              },
              {
                id: "locker" as const,
                title: "Locker",
                subtitle: "Your achievements",
                icon: Package,
                stats: { value: homeQuery.data.lockerItemCount, label: "Items" }
              }
            ]}
            onNavigate={navigate}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar
        currentScreen={route}
        onNavigate={navigate}
        onLogout={onLogout}
      />

      <main className="min-h-screen bg-grid bg-radial pt-20 pb-24 lg:ml-64 lg:pt-0 lg:pb-0">
        {route === "home" ? (
          renderScreen()
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {renderScreen()}
          </div>
        )}
      </main>
    </div>
  );
}

function PageLoading({ message }: { message: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
        <p className="mt-4 text-sm text-text-muted">{message}</p>
      </div>
    </div>
  );
}

function PageError({ message }: { message: string }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}
