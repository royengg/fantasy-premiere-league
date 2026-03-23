import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, createApiClient } from "@fantasy-cricket/api-client";
import type { BuildRosterInput } from "@fantasy-cricket/types";

import { AuthenticatedDashboard } from "./components/AuthenticatedDashboard";
import { AuthScreen } from "./components/AuthScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
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

  const bootstrapQuery = useQuery({
    queryKey: ["bootstrap", sessionToken],
    queryFn: () => api.getBootstrap(),
    enabled: Boolean(sessionToken),
    retry: false
  });

  const hasExpiredSession = Boolean(
    sessionToken && bootstrapQuery.isError && isExpiredSessionError(bootstrapQuery.error)
  );

  useEffect(() => {
    if (!hasExpiredSession) {
      return;
    }

    clearSession();
    setSessionNotice("Your session expired. Sign in again to continue.");
    queryClient.clear();
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] })
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout()
  });

  const rosterMutation = useMutation({
    mutationFn: ({ contestId, payload }: { contestId: string; payload: BuildRosterInput }) =>
      api.submitRoster(contestId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contests"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    }
  });

  const answerMutation = useMutation({
    mutationFn: ({ questionId, optionId }: { questionId: string; optionId: string }) =>
      api.answerPrediction(questionId, optionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["predictions"] })
  });

  const equipMutation = useMutation({
    mutationFn: (cosmeticId: string) => api.equipCosmetic(cosmeticId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] })
  });

  const createLeagueMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      visibility: "public" | "private";
      maxMembers: number;
    }) =>
      api.createLeague(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    }
  });

  const joinLeagueMutation = useMutation({
    mutationFn: (inviteCode: string) => api.joinLeague(inviteCode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    }
  });

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Local session state is still cleared even if the revoke request fails.
    }

    clearSession();
    queryClient.clear();
  };

  if (!sessionToken) {
    return (
      <AuthScreen
        onLogin={(payload) => loginMutation.mutateAsync(payload)}
        onRegister={(payload) => registerMutation.mutateAsync(payload)}
        notice={sessionNotice}
      />
    );
  }

  if (bootstrapQuery.isLoading || hasExpiredSession) {
    return <FullScreenSpinner />;
  }

  if (bootstrapQuery.isError || !bootstrapQuery.data) {
    return (
      <FullScreenError
        message={(bootstrapQuery.error as Error)?.message ?? "Failed to load"}
      />
    );
  }

  if (!bootstrapQuery.data.profile.onboardingCompleted) {
    return (
      <OnboardingScreen
        name={bootstrapQuery.data.user.name}
        initialUsername={bootstrapQuery.data.profile.username}
        initialFavoriteTeamId={bootstrapQuery.data.profile.favoriteTeamId}
        teams={bootstrapQuery.data.teams}
        onSubmit={(payload) => onboardingMutation.mutateAsync(payload)}
      />
    );
  }

  return (
    <AuthenticatedDashboard
      bootstrap={bootstrapQuery.data}
      api={api}
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
  );
}
