import type {
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
  getUserId?: () => string | null;
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  getUserId?: () => string | null
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const userId = getUserId?.();
  if (userId) {
    headers.set("x-user-id", userId);
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

export function createApiClient({ baseUrl, getUserId }: ApiClientOptions) {
  return {
    bootstrap: (payload: { email: string; name: string }) =>
      request<{ userId: string; profileUsername: string }>(baseUrl, "/api/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    getDashboard: () => request<DashboardPayload>(baseUrl, "/api/bootstrap", { method: "GET" }, getUserId),
    createLeague: (payload: { name: string; description?: string; visibility: "public" | "private" }) =>
      request<League>(baseUrl, "/api/leagues", { method: "POST", body: JSON.stringify(payload) }, getUserId),
    joinLeague: (inviteCode: string) =>
      request<League>(baseUrl, "/api/leagues/join", { method: "POST", body: JSON.stringify({ inviteCode }) }, getUserId),
    submitRoster: (contestId: string, payload: BuildRosterInput) =>
      request<Roster>(baseUrl, `/api/contests/${contestId}/roster`, { method: "POST", body: JSON.stringify(payload) }, getUserId),
    answerPrediction: (questionId: string, optionId: string) =>
      request<PredictionAnswer>(baseUrl, `/api/predictions/${questionId}/answer`, { method: "POST", body: JSON.stringify({ optionId }) }, getUserId),
    getInventory: () =>
      request<{ cosmetics: CosmeticItem[]; equipped: DashboardPayload["inventory"]["equipped"] }>(
        baseUrl,
        "/api/inventory",
        { method: "GET" },
        getUserId
      ),
    equipCosmetic: (cosmeticId: string) =>
      request<{ cosmeticId: string }>(baseUrl, "/api/inventory/equip", { method: "POST", body: JSON.stringify({ cosmeticId }) }, getUserId),
    syncProvider: () => request<{ status: string; syncedAt: string }>(baseUrl, "/api/admin/provider-sync", { method: "POST" }, getUserId),
    applyCorrection: (matchId: string, payload: { playerId: string; points: number; label: string }) =>
      request<{ status: string }>(baseUrl, `/api/admin/matches/${matchId}/corrections`, { method: "POST", body: JSON.stringify(payload) }, getUserId)
  };
}
