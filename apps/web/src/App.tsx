import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { Star, Flame, Crown, Users, Trophy, Target, Package } from "lucide-react";

import { createApiClient } from "@fantasy-cricket/api-client";
import type { BuildRosterInput } from "@fantasy-cricket/types";

import { ThemeProvider } from "./components/ThemeProvider";
import { Sidebar } from "./components/Sidebar";
import { NavigationCard } from "./components/NavigationCard";
import { ContestView } from "./components/ContestView";
import { LeagueView } from "./components/LeagueView";
import { PredictionView } from "./components/PredictionView";
import { LockerView } from "./components/LockerView";
import { AuthScreen } from "./components/AuthScreen";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const STORAGE_KEY = "fantasy-cricket-session-token";
const LEGACY_STORAGE_KEY = "fantasy-cricket-session";

type Screen = "home" | "contests" | "leagues" | "predictions" | "locker";

function getStoredSessionToken() {
  return window.localStorage.getItem(STORAGE_KEY);
}

function isExpiredSessionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Authentication required") ||
    error.message.includes("Session expired") ||
    error.message.includes("Unknown user") ||
    error.message.includes("Unknown profile") ||
    error.message.includes("Inventory not found")
  );
}

export function App() {
  const queryClient = useQueryClient();
  const [sessionToken, setSessionToken] = useState<string | null>(() => getStoredSessionToken());
  const [screen, setScreen] = useState<Screen>("home");
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  
  const api = useMemo(
    () => createApiClient({ baseUrl: API_URL, getSessionToken: () => sessionToken }),
    [sessionToken]
  );

  useEffect(() => {
    if (!sessionToken) return;
    const socket = io(API_URL, { auth: { token: sessionToken } });
    socket.on("contest:leaderboard", () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }));
    socket.on("league:activity", () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }));
    socket.on("user:refresh", () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }));
    return () => { socket.close(); };
  }, [queryClient, sessionToken]);

  const { data: dashboard, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard", sessionToken],
    queryFn: () => api.getDashboard(),
    enabled: Boolean(sessionToken),
    retry: false
  });
  const hasExpiredSession = Boolean(sessionToken && isError && isExpiredSessionError(error));

  useEffect(() => {
    if (!hasExpiredSession) {
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    setSessionToken(null);
    setSessionNotice("Your previous local session expired after the backend reset. Sign in again to continue.");
    queryClient.removeQueries({ queryKey: ["dashboard"] });
  }, [hasExpiredSession, queryClient]);

  const bootstrapMutation = useMutation({
    mutationFn: (payload: { name: string; email: string }) => api.bootstrap(payload),
    onSuccess: (session) => {
      window.localStorage.setItem(STORAGE_KEY, session.token);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      setSessionNotice(null);
      setSessionToken(session.token);
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

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setSessionToken(null);
  };

  if (!sessionToken) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthScreen
          onSubmit={(p: { name: string; email: string }) => bootstrapMutation.mutateAsync(p)}
          notice={sessionNotice}
        />
      </ThemeProvider>
    );
  }

  if (isLoading) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      </ThemeProvider>
    );
  }

  if (hasExpiredSession) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
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
      subtitle: "Select your playing XI",
      icon: Users,
      stats: { value: dashboard.contests.length, label: "Live Matches" }
    },
    {
      id: "leagues" as Screen,
      title: "Leagues",
      subtitle: "Compete with friends",
      icon: Trophy,
      stats: { value: dashboard.leagues.length, label: "Active" }
    },
    {
      id: "predictions" as Screen,
      title: "Predictions",
      subtitle: "Predict match outcomes",
      icon: Target,
      stats: { value: dashboard.profile.streak, label: "Day Streak" }
    },
    {
      id: "locker" as Screen,
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

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-surface">
        <Sidebar 
          currentScreen={screen}
          onNavigate={(s) => setScreen(s as Screen)}
          onLogout={handleLogout}
        />
        
        <main className="ml-16 lg:ml-64 min-h-screen bg-grid bg-radial">
          {screen === "home" ? (
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-8">
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
          ) : (
            <div className="p-6 lg:p-8">
              {renderScreen()}
            </div>
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}
