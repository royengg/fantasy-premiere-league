import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { Trophy, Users, Swords, Package, ShieldAlert } from "lucide-react";

import { createApiClient } from "@fantasy-cricket/api-client";
import type { BuildRosterInput } from "@fantasy-cricket/types";

import { ThemeProvider } from "./components/ThemeProvider";
import { Topbar } from "./components/layout/Topbar";
import { ContestCard } from "./components/ContestCard";
import { LeaguePanel } from "./components/LeaguePanel";
import { LockerPanel } from "./components/LockerPanel";
import { PredictionPanel } from "./components/PredictionPanel";
import { SignInForm } from "./components/SignInForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const STORAGE_KEY = "fantasy-cricket-session";

function getStoredUserId() {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function App() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(() => getStoredUserId());
  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: API_URL,
        getUserId: () => userId
      }),
    [userId]
  );

  useEffect(() => {
    if (!userId) return;

    const socket = io(API_URL, {
      extraHeaders: {
        "x-user-id": userId
      }
    });

    socket.on("contest:leaderboard", () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    });

    socket.on("league:activity", () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    });

    return () => {
      socket.close();
    };
  }, [queryClient, userId]);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => api.getDashboard(),
    enabled: Boolean(userId)
  });

  const bootstrapMutation = useMutation({
    mutationFn: (payload: { name: string; email: string }) => api.bootstrap(payload),
    onSuccess: (session) => {
      window.localStorage.setItem(STORAGE_KEY, session.userId);
      setUserId(session.userId);
    }
  });

  const rosterMutation = useMutation({
    mutationFn: ({ contestId, payload }: { contestId: string; payload: BuildRosterInput }) =>
      api.submitRoster(contestId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const answerMutation = useMutation({
    mutationFn: ({ questionId, optionId }: { questionId: string; optionId: string }) =>
      api.answerPrediction(questionId, optionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const equipMutation = useMutation({
    mutationFn: (cosmeticId: string) => api.equipCosmetic(cosmeticId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const createLeagueMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string; visibility: "public" | "private" }) =>
      api.createLeague(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const joinLeagueMutation = useMutation({
    mutationFn: (inviteCode: string) => api.joinLeague(inviteCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  if (!userId) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <SignInForm onSubmit={(payload) => bootstrapMutation.mutateAsync(payload)} />
      </ThemeProvider>
    );
  }

  if (dashboardQuery.isLoading) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground font-medium animate-pulse">Loading Clubhouse...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md border-destructive/50 glass-panel">
            <CardContent className="pt-6 text-center">
              <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
              <p className="text-foreground font-medium mb-4">
                {(dashboardQuery.error as Error | undefined)?.message ?? "Could not load the dashboard."}
              </p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  const dashboard = dashboardQuery.data;

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="relative flex min-h-screen flex-col bg-background selection:bg-primary/30">
        <Topbar 
          username={dashboard.profile.username}
          level={dashboard.profile.level}
          onSwitchAccount={() => {
            window.localStorage.removeItem(STORAGE_KEY);
            setUserId(null);
          }}
        />

        <main className="flex-1">
          <div className="container py-8 max-w-6xl mx-auto space-y-8">
            {/* Hero Stats Section - Inspired by FM UI overhead status */}
            <div className="dashboard-grid">
              <Card className="glass-panel overflow-hidden border-primary/20 relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Total XP</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tight">{dashboard.profile.xp}</span>
                    <span className="text-sm font-medium text-muted-foreground">points</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed hidden sm:block">
                    Earned only from fantasy participation, predictions, and milestone cosmetics.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="glass-panel overflow-hidden border-secondary/20 relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary">Current Streak</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tight">{dashboard.profile.streak}</span>
                    <span className="text-sm font-medium text-muted-foreground">days</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed hidden sm:block">
                    Prediction streaks unlock badges and cosmetic drops. No gameplay advantages.
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-panel overflow-hidden border-border bg-card/40">
                <CardContent className="p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Guardrails</span>
                  <div className="mt-2">
                    <span className="text-2xl font-bold tracking-tight text-foreground/90">No Wallets</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    Zero deposits. No payouts. No outcome-linked cash economy. Built for pure competition.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Area - Tabbed Navigation */}
            <Tabs defaultValue="contests" className="w-full">
              <TabsList className="grid w-full grid-cols-4 lg:w-[600px] bg-background border border-border/50 h-14 p-1 rounded-2xl">
                <TabsTrigger value="contests" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all">
                  <Swords className="w-4 h-4 mr-2 hidden sm:block" />
                  Contests
                </TabsTrigger>
                <TabsTrigger value="leagues" className="rounded-xl data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 transition-all">
                  <Trophy className="w-4 h-4 mr-2 hidden sm:block" />
                  Leagues
                </TabsTrigger>
                <TabsTrigger value="predictions" className="rounded-xl data-[state=active]:bg-secondary/10 data-[state=active]:text-secondary transition-all">
                  <Users className="w-4 h-4 mr-2 hidden sm:block" />
                  Predictions
                </TabsTrigger>
                <TabsTrigger value="locker" className="rounded-xl data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 transition-all">
                  <Package className="w-4 h-4 mr-2 hidden sm:block" />
                  Locker
                </TabsTrigger>
              </TabsList>

              <div className="mt-8 rounded-3xl pb-10">
                <TabsContent value="contests" className="space-y-6 m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {dashboard.contests.map((contest) => {
                    const match = dashboard.matches.find((entry) => entry.id === contest.matchId);
                    if (!match) return null;

                    const players = dashboard.players.filter(
                      (player) => player.teamId === match.homeTeamId || player.teamId === match.awayTeamId
                    );

                    return (
                      <ContestCard
                        key={contest.id}
                        contest={contest}
                        match={match}
                        teams={dashboard.teams}
                        players={players}
                        existingRoster={dashboard.rosters.find(
                          (roster) => roster.contestId === contest.id && roster.userId === dashboard.user.id
                        )}
                        leaderboard={dashboard.leaderboard.filter((entry) => entry.contestId === contest.id)}
                        onSubmit={(contestId, payload) => rosterMutation.mutateAsync({ contestId, payload })}
                      />
                    );
                  })}
                  {dashboard.contests.length === 0 && (
                    <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-border">
                      <Swords className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium text-foreground">No Active Contests</h3>
                      <p className="text-sm text-muted-foreground mt-1">Check back later for upcoming matches.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="leagues" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <LeaguePanel
                    leagues={dashboard.leagues}
                    onCreateLeague={(payload) => createLeagueMutation.mutateAsync(payload)}
                    onJoinLeague={(inviteCode) => joinLeagueMutation.mutateAsync(inviteCode)}
                  />
                </TabsContent>

                <TabsContent value="predictions" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <PredictionPanel
                    questions={dashboard.questions}
                    answers={dashboard.answers}
                    onAnswer={(questionId, optionId) => answerMutation.mutateAsync({ questionId, optionId })}
                  />
                </TabsContent>

                <TabsContent value="locker" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <LockerPanel
                    inventory={dashboard.inventory}
                    cosmetics={dashboard.cosmetics}
                    badges={dashboard.badges}
                    profile={dashboard.profile}
                    onEquip={(cosmeticId) => equipMutation.mutateAsync(cosmeticId)}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

