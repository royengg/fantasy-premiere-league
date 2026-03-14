import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { Swords, Trophy, Brain, Package, ArrowLeft, Zap, Flame, Crown } from "lucide-react";

import { createApiClient } from "@fantasy-cricket/api-client";
import type { BuildRosterInput } from "@fantasy-cricket/types";

import { ThemeProvider } from "./components/ThemeProvider";
import { Navbar } from "./components/Navbar";
import { NavigationCard } from "./components/NavigationCard";
import { ContestView } from "./components/ContestView";
import { LeagueView } from "./components/LeagueView";
import { PredictionView } from "./components/PredictionView";
import { LockerView } from "./components/LockerView";
import { AuthScreen } from "./components/AuthScreen";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const STORAGE_KEY = "fantasy-cricket-session";

type Screen = "home" | "contests" | "leagues" | "predictions" | "locker";

function getStoredUserId() {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function App() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(() => getStoredUserId());
  const [screen, setScreen] = useState<Screen>("home");
  
  const api = useMemo(
    () => createApiClient({ baseUrl: API_URL, getUserId: () => userId }),
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    const socket = io(API_URL, { extraHeaders: { "x-user-id": userId } });
    socket.on("contest:leaderboard", () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }));
    socket.on("league:activity", () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }));
    return () => { socket.close(); };
  }, [queryClient, userId]);

  const { data: dashboard, isLoading, isError, error } = useQuery({
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  });

  const answerMutation = useMutation({
    mutationFn: ({ questionId, optionId }: { questionId: string; optionId: string }) =>
      api.answerPrediction(questionId, optionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  });

  const equipMutation = useMutation({
    mutationFn: (cosmeticId: string) => api.equipCosmetic(cosmeticId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  });

  const createLeagueMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string; visibility: "public" | "private" }) =>
      api.createLeague(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  });

  const joinLeagueMutation = useMutation({
    mutationFn: (inviteCode: string) => api.joinLeague(inviteCode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  });

  if (!userId) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthScreen onSubmit={(p: { name: string; email: string }) => bootstrapMutation.mutateAsync(p)} />
      </ThemeProvider>
    );
  }

  if (isLoading) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-accent-green/20 border-t-accent-green rounded-full animate-spin" />
        </div>
      </ThemeProvider>
    );
  }

  if (isError || !dashboard) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="min-h-screen bg-surface flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-text-muted mb-4">{(error as Error)?.message ?? "Failed to load"}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary">Retry</button>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  const navItems = [
    {
      id: "contests" as Screen,
      title: "Contests",
      subtitle: "Build your XI",
      icon: Swords,
      accent: "green" as const,
      stats: { value: dashboard.contests.length, label: "Live" }
    },
    {
      id: "leagues" as Screen,
      title: "Leagues",
      subtitle: "Compete with friends",
      icon: Trophy,
      accent: "orange" as const,
      stats: { value: dashboard.leagues.length, label: "Active" }
    },
    {
      id: "predictions" as Screen,
      title: "Predict",
      subtitle: "Earn XP rewards",
      icon: Brain,
      accent: "blue" as const,
      stats: { value: dashboard.profile.streak, label: "Day Streak" }
    },
    {
      id: "locker" as Screen,
      title: "Locker",
      subtitle: "Your collection",
      icon: Package,
      accent: "purple" as const,
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
            userId={dashboard.user.id}
            onSubmit={(cid: string, p: BuildRosterInput) => rosterMutation.mutateAsync({ contestId: cid, payload: p })}
          />
        );
      case "leagues":
        return (
          <LeagueView
            leagues={dashboard.leagues}
            onCreate={(p: { name: string; description?: string; visibility: "public" | "private" }) => createLeagueMutation.mutateAsync(p)}
            onJoin={(c: string) => joinLeagueMutation.mutateAsync(c)}
          />
        );
      case "predictions":
        return (
          <PredictionView
            questions={dashboard.questions}
            answers={dashboard.answers}
            streak={dashboard.profile.streak}
            onAnswer={(qid: string, oid: string) => answerMutation.mutateAsync({ questionId: qid, optionId: oid })}
          />
        );
      case "locker":
        return (
          <LockerView
            inventory={dashboard.inventory}
            cosmetics={dashboard.cosmetics}
            badges={dashboard.badges}
            profile={dashboard.profile}
            onEquip={(id: string) => equipMutation.mutateAsync(id)}
          />
        );
      default:
        return null;
    }
  };

  if (screen !== "home") {
    const currentItem = navItems.find(i => i.id === screen);
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="min-h-screen bg-surface bg-grid">
          <Navbar
            username={dashboard.profile.username}
            xp={dashboard.profile.xp}
            level={dashboard.profile.level}
            onLogout={() => { localStorage.removeItem(STORAGE_KEY); setUserId(null); }}
          />
          <main className="max-w-6xl mx-auto px-4 py-6">
            <button
              onClick={() => setScreen("home")}
              className="flex items-center gap-2 text-text-muted hover:text-text transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Home</span>
            </button>
            {renderScreen()}
          </main>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-surface bg-grid bg-radial">
        <Navbar
          username={dashboard.profile.username}
          xp={dashboard.profile.xp}
          level={dashboard.profile.level}
          onLogout={() => { localStorage.removeItem(STORAGE_KEY); setUserId(null); }}
        />
        
        <main className="max-w-6xl mx-auto px-4 py-8">
          <header className="mb-12">
            <p className="text-accent-green text-xs font-bold uppercase tracking-widest mb-2">Season 1</p>
            <h1 className="text-5xl font-extrabold tracking-tight mb-3">
              Hey, {dashboard.profile.username.split(" ")[0]}
            </h1>
            <p className="text-text-muted text-lg">What are you playing today?</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {navItems.map(item => (
              <NavigationCard
                key={item.id}
                {...item}
                onClick={() => setScreen(item.id)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-block">
              <Zap className="w-5 h-5 text-accent-green mb-2" />
              <span className="stat-value text-gradient-green">{dashboard.profile.xp.toLocaleString()}</span>
              <span className="stat-label">Total XP</span>
            </div>
            <div className="stat-block">
              <Flame className="w-5 h-5 text-accent-orange mb-2" />
              <span className="stat-value text-gradient-orange">{dashboard.profile.streak}</span>
              <span className="stat-label">Day Streak</span>
            </div>
            <div className="stat-block">
              <Crown className="w-5 h-5 text-accent-gold mb-2" />
              <span className="stat-value text-gradient-orange">Lv.{dashboard.profile.level}</span>
              <span className="stat-label">Current Rank</span>
            </div>
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}