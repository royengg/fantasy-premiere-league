import type {
  AuctionCatalogPlayer,
  AuctionRoomDetails,
  AuctionRoomSummary,
  AuthResponse,
  BootstrapPayload,
  BuildRosterInput,
  CosmeticItem,
  ContestPagePayload,
  HomePagePayload,
  InventoryPagePayload,
  League,
  Profile,
  PredictionAnswer,
  PredictionPagePayload,
  PredictionQuestion,
  Roster,
  TeamWithPlayers
} from "@fantasy-cricket/types";

export interface ApiClientOptions {
  baseUrl: string;
  getSessionToken?: () => string | null;
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
  getSessionToken?: () => string | null
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const sessionToken = getSessionToken?.();
  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
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

export function createApiClient({ baseUrl, getSessionToken }: ApiClientOptions) {
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
    getBootstrap: () => request<BootstrapPayload>(baseUrl, "/api/bootstrap", { method: "GET" }, getSessionToken),
    getHome: () => request<HomePagePayload>(baseUrl, "/api/home", { method: "GET" }, getSessionToken),
    getContestsPage: () => request<ContestPagePayload>(baseUrl, "/api/contests", { method: "GET" }, getSessionToken),
    getLeagues: () => request<League[]>(baseUrl, "/api/leagues", { method: "GET" }, getSessionToken),
    getPredictionsPage: () => request<PredictionPagePayload>(baseUrl, "/api/predictions", { method: "GET" }, getSessionToken),
    getInventoryPage: () => request<InventoryPagePayload>(baseUrl, "/api/inventory", { method: "GET" }, getSessionToken),
    getTeamsWithPlayers: () => request<TeamWithPlayers[]>(baseUrl, "/api/teams", { method: "GET" }, getSessionToken),
    createLeague: (payload: {
      name: string;
      description?: string;
      visibility: "public" | "private";
      maxMembers: number;
    }) =>
      request<League>(baseUrl, "/api/leagues", { method: "POST", body: JSON.stringify(payload) }, getSessionToken),
    joinLeague: (inviteCode: string) =>
      request<League>(baseUrl, "/api/leagues/join", { method: "POST", body: JSON.stringify({ inviteCode }) }, getSessionToken),
    deleteLeague: (leagueId: string) =>
      request<{ leagueId: string }>(baseUrl, `/api/leagues/${leagueId}`, { method: "DELETE" }, getSessionToken),
    getAuctionRooms: () =>
      request<AuctionRoomSummary[]>(baseUrl, "/api/auctions", { method: "GET" }, getSessionToken),
    getAuctionCatalogPlayers: () =>
      request<AuctionCatalogPlayer[]>(baseUrl, "/api/auctions/catalog/players", { method: "GET" }, getSessionToken),
    getAuctionRoom: (roomId: string) =>
      request<AuctionRoomDetails>(baseUrl, `/api/auctions/${roomId}`, { method: "GET" }, getSessionToken),
    createAuctionRoom: (payload: {
      leagueId?: string;
      name: string;
      visibility: "public" | "private";
      maxParticipants: number;
      squadSize: number;
      bidWindowSeconds: number;
      bidExtensionSeconds: number;
      playerPoolMode: "all" | "custom";
      playerPoolPlayerIds?: string[];
    }) =>
      request<AuctionRoomDetails>(baseUrl, "/api/auctions", {
        method: "POST",
        body: JSON.stringify(payload)
      }, getSessionToken),
    updateAuctionRoomSettings: (roomId: string, payload: {
      name: string;
      maxParticipants: number;
      squadSize: number;
      bidWindowSeconds: number;
      bidExtensionSeconds: number;
      playerPoolMode: "all" | "custom";
      playerPoolPlayerIds?: string[];
    }) =>
      request<AuctionRoomDetails>(baseUrl, `/api/auctions/${roomId}/settings`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      }, getSessionToken),
    joinAuctionRoom: (payload: { roomId?: string; inviteCode?: string }) =>
      request<AuctionRoomDetails>(baseUrl, "/api/auctions/join", {
        method: "POST",
        body: JSON.stringify(payload)
      }, getSessionToken),
    setAuctionReady: (roomId: string, ready: boolean) =>
      request<AuctionRoomDetails>(baseUrl, `/api/auctions/${roomId}/ready`, {
        method: "POST",
        body: JSON.stringify({ ready })
      }, getSessionToken),
    startAuctionRoom: (roomId: string) =>
      request<AuctionRoomDetails>(baseUrl, `/api/auctions/${roomId}/start`, {
        method: "POST"
      }, getSessionToken),
    placeAuctionBid: (roomId: string, amountLakhs: number) =>
      request<AuctionRoomDetails>(baseUrl, `/api/auctions/${roomId}/bid`, {
        method: "POST",
        body: JSON.stringify({ amountLakhs })
      }, getSessionToken),
    withdrawAuctionBid: (roomId: string) =>
      request<AuctionRoomDetails>(baseUrl, `/api/auctions/${roomId}/withdraw`, {
        method: "POST"
      }, getSessionToken),
    skipAuctionLot: (roomId: string) =>
      request<AuctionRoomDetails>(baseUrl, `/api/auctions/${roomId}/skip`, {
        method: "POST"
      }, getSessionToken),
    submitRoster: (contestId: string, payload: BuildRosterInput) =>
      request<Roster>(baseUrl, `/api/contests/${contestId}/roster`, { method: "POST", body: JSON.stringify(payload) }, getSessionToken),
    answerPrediction: (questionId: string, optionId: string) =>
      request<PredictionAnswer>(baseUrl, `/api/predictions/${questionId}/answer`, { method: "POST", body: JSON.stringify({ optionId }) }, getSessionToken),
    equipCosmetic: (cosmeticId: string) =>
      request<{ cosmeticId: string }>(baseUrl, "/api/inventory/equip", { method: "POST", body: JSON.stringify({ cosmeticId }) }, getSessionToken),
    syncProvider: () => request<{ status: string; syncedAt: string }>(baseUrl, "/api/admin/provider-sync", { method: "POST" }, getSessionToken),
    applyCorrection: (matchId: string, payload: { playerId: string; points: number; label: string }) =>
      request<{ status: string }>(baseUrl, `/api/admin/matches/${matchId}/corrections`, { method: "POST", body: JSON.stringify(payload) }, getSessionToken),
    settlePrediction: (questionId: string, correctOptionId: string) =>
      request<{ settledCount: number; correctOptionId: string }>(
        baseUrl,
        `/api/admin/predictions/${questionId}/settle`,
        { method: "POST", body: JSON.stringify({ correctOptionId }) },
        getSessionToken
      )
  };
}
