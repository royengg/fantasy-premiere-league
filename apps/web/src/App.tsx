import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, createApiClient } from "@fantasy-cricket/api-client";
import type { BuildRosterInput } from "@fantasy-cricket/types";

import { AuthenticatedDashboard } from "./components/AuthenticatedDashboard";
import { AuthScreen } from "./components/AuthScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { ThemeProvider } from "./components/ThemeProvider";
import { useRealtimeDashboard } from "./hooks/use-realtime-dashboard";
import { useSessionToken } from "./hooks/use-session-token";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function isExpiredSessionError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
    </div>
  );
}

function FullScreenError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-text-muted mb-4">{message}</p>
        <button onClick={() => window.location.reload()} className="btn-secondary">Retry</button>
      </div>
    </div>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const { sessionToken, persistSession, clearSession } = useSessionToken();
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const api = useMemo(
    () => createApiClient({ baseUrl: API_URL, getSessionToken: () => sessionToken }),
    [sessionToken]
  );

  const handleAuthenticated = (token: string) => {
    setSessionNotice(null);
    persistSession(token);
  };

  useRealtimeDashboard(API_URL, sessionToken, queryClient);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", sessionToken],
    queryFn: () => api.getDashboard(),
    enabled: Boolean(sessionToken),
    retry: false
  });

  const hasExpiredSession = Boolean(
    sessionToken && dashboardQuery.isError && isExpiredSessionError(dashboardQuery.error)
  );

  useEffect(() => {
    if (!hasExpiredSession) {
      return;
    }

    clearSession();
    setSessionNotice("Your session expired. Sign in again to continue.");
    queryClient.removeQueries({ queryKey: ["dashboard"] });
  }, [clearSession, hasExpiredSession, queryClient]);

  const registerMutation = useMutation({
    mutationFn: (payload: { name: string; email: string; password: string }) => api.register(payload),
    onSuccess: (session) => handleAuthenticated(session.token)
  });

  const loginMutation = useMutation({
    mutationFn: (payload: { email: string; password: string }) => api.login(payload),
    onSuccess: (session) => handleAuthenticated(session.token)
  });

  const onboardingMutation = useMutation({
    mutationFn: (payload: { username: string; favoriteTeamId: string }) =>
      api.completeOnboarding(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout()
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

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Local session state is still cleared even if the revoke request fails.
    }

    clearSession();
    queryClient.removeQueries({ queryKey: ["dashboard"] });
  };

  if (!sessionToken) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthScreen
          onLogin={(payload) => loginMutation.mutateAsync(payload)}
          onRegister={(payload) => registerMutation.mutateAsync(payload)}
          notice={sessionNotice}
        />
      </ThemeProvider>
    );
  }

  if (dashboardQuery.isLoading || hasExpiredSession) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <FullScreenSpinner />
      </ThemeProvider>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <FullScreenError
          message={(dashboardQuery.error as Error)?.message ?? "Failed to load"}
        />
      </ThemeProvider>
    );
  }

  if (!dashboardQuery.data.profile.onboardingCompleted) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <OnboardingScreen
          name={dashboardQuery.data.user.name}
          initialUsername={dashboardQuery.data.profile.username}
          initialFavoriteTeamId={dashboardQuery.data.profile.favoriteTeamId}
          teams={dashboardQuery.data.teams}
          onSubmit={(payload) => onboardingMutation.mutateAsync(payload)}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthenticatedDashboard
        dashboard={dashboardQuery.data}
        onLogout={handleLogout}
        onSubmitRoster={(contestId, payload) =>
          rosterMutation.mutateAsync({ contestId, payload })
        }
        onCreateLeague={(payload) => createLeagueMutation.mutateAsync(payload)}
        onJoinLeague={(inviteCode) => joinLeagueMutation.mutateAsync(inviteCode)}
        onAnswerPrediction={(questionId, optionId) =>
          answerMutation.mutateAsync({ questionId, optionId })
        }
        onEquipCosmetic={(cosmeticId) => equipMutation.mutateAsync(cosmeticId)}
      />
    </ThemeProvider>
  );
}
