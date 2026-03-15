import type {
  AuthBootstrapResponse,
  BuildRosterInput,
  CosmeticItem,
  DashboardPayload,
  League,
  PredictionAnswer,
  PredictionQuestion,
  Roster
} from "@fantasy-cricket/types";

export interface ApiClientOptions {
  baseUrl: string;
  getSessionToken?: () => string | null;
  getAdminKey?: () => string | null;
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
    const body = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(body.message ?? "Request failed.");
  }

  return response.json() as Promise<T>;
}

export function createApiClient({ baseUrl, getSessionToken, getAdminKey }: ApiClientOptions) {
  return {
    bootstrap: (payload: { email: string; name: string }) =>
      request<AuthBootstrapResponse>(baseUrl, "/api/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
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
