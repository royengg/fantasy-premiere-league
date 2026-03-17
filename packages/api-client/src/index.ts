import type {
  AuthResponse,
  BuildRosterInput,
  CosmeticItem,
  DashboardPayload,
  League,
  Profile,
  PredictionAnswer,
  PredictionQuestion,
  Roster
} from "@fantasy-cricket/types";

export interface ApiClientOptions {
  baseUrl: string;
  getSessionToken?: () => string | null;
  getAdminKey?: () => string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  getSessionToken?: () => string | null,
  getAdminKey?: () => string | null
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const sessionToken = getSessionToken?.();
  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }

  const adminKey = getAdminKey?.();
  if (adminKey) {
    headers.set("x-admin-key", adminKey);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ message: "Request failed.", code: undefined as string | undefined }));
    throw new ApiError(body.message ?? "Request failed.", response.status, body.code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function createApiClient({ baseUrl, getSessionToken, getAdminKey }: ApiClientOptions) {
  return {
    register: (payload: { email: string; name: string; password: string }) =>
      request<AuthResponse>(baseUrl, "/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    login: (payload: { email: string; password: string }) =>
      request<AuthResponse>(baseUrl, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    logout: () =>
      request<void>(baseUrl, "/api/auth/logout", { method: "POST" }, getSessionToken),
    completeOnboarding: (payload: { username: string; favoriteTeamId: string }) =>
      request<Profile>(baseUrl, "/api/auth/onboarding", {
        method: "PATCH",
        body: JSON.stringify(payload)
      }, getSessionToken),
    getDashboard: () => request<DashboardPayload>(baseUrl, "/api/bootstrap", { method: "GET" }, getSessionToken),
    createLeague: (payload: { name: string; description?: string; visibility: "public" | "private" }) =>
      request<League>(baseUrl, "/api/leagues", { method: "POST", body: JSON.stringify(payload) }, getSessionToken),
    joinLeague: (inviteCode: string) =>
      request<League>(baseUrl, "/api/leagues/join", { method: "POST", body: JSON.stringify({ inviteCode }) }, getSessionToken),
    submitRoster: (contestId: string, payload: BuildRosterInput) =>
      request<Roster>(baseUrl, `/api/contests/${contestId}/roster`, { method: "POST", body: JSON.stringify(payload) }, getSessionToken),
    answerPrediction: (questionId: string, optionId: string) =>
      request<PredictionAnswer>(baseUrl, `/api/predictions/${questionId}/answer`, { method: "POST", body: JSON.stringify({ optionId }) }, getSessionToken),
    getInventory: () =>
      request<{ cosmetics: CosmeticItem[]; equipped: DashboardPayload["inventory"]["equipped"] }>(
        baseUrl,
        "/api/inventory",
        { method: "GET" },
        getSessionToken
      ),
    equipCosmetic: (cosmeticId: string) =>
      request<{ cosmeticId: string }>(baseUrl, "/api/inventory/equip", { method: "POST", body: JSON.stringify({ cosmeticId }) }, getSessionToken),
    syncProvider: () => request<{ status: string; syncedAt: string }>(baseUrl, "/api/admin/provider-sync", { method: "POST" }, getSessionToken, getAdminKey),
    applyCorrection: (matchId: string, payload: { playerId: string; points: number; label: string }) =>
      request<{ status: string }>(baseUrl, `/api/admin/matches/${matchId}/corrections`, { method: "POST", body: JSON.stringify(payload) }, getSessionToken, getAdminKey),
    settlePrediction: (questionId: string, correctOptionId: string) =>
      request<{ settledCount: number; correctOptionId: string }>(
        baseUrl,
        `/api/admin/predictions/${questionId}/settle`,
        { method: "POST", body: JSON.stringify({ correctOptionId }) },
        getSessionToken,
        getAdminKey
      )
  };
}
