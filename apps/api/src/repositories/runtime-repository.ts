import type {
  BuildRosterInput,
  AuthResponse,
  BootstrapPayload,
  Contest,
  ContestPagePayload,
  CosmeticItem,
  DashboardPayload,
  HomePagePayload,
  InventoryPagePayload,
  LeaderboardEntry,
  League,
  PredictionAnswer,
  PredictionFeedPayload,
  PredictionPagePayload,
  Profile,
  Roster,
  TeamWithPlayers,
  User,
  UserInventory
} from "@fantasy-cricket/types";
import type {
  CreateLeagueInput,
  JoinLeagueInput,
  PredictionAnswerInput,
  SubmitRosterInput
} from "@fantasy-cricket/validators";

import type { ProviderSyncSnapshot } from "../services/provider-sync-service.js";

export interface ProviderStateSnapshot {
  status: "idle" | "syncing" | "ready";
  syncedAt: string;
  lastAttemptedAt: string;
  requestDayKey: string;
  dailyRequestCount: number;
  blockedUntil?: string;
}

export interface AuthRuntimeRepository {
  listProfileUsernamesByBase(baseUsername: string): Promise<string[]>;
  findUserLoginRecord(email: string): Promise<{
    user: User;
    profile: Profile;
    passwordHash: string;
  } | null>;
  createRegisteredUserRecord(payload: {
    user: User;
    profile: Profile;
    passwordHash: string;
    sessionHash: string;
    sessionCreatedAt: string;
    sessionExpiresAt: string;
  }): Promise<void>;
  createHashedSession(payload: {
    userId: string;
    sessionHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<void>;
  hasAnyAdminUser(): Promise<boolean>;
  completeOnboardingProfile(payload: {
    userId: string;
    username: string;
    favoriteTeamId: string;
  }): Promise<Profile>;
  findActiveSessionUserId(sessionHash: string, now: string): Promise<string | null>;
  deleteSessionByHash(sessionHash: string): Promise<void>;
  isUserAdmin(userId: string): Promise<boolean>;
}

export interface ProviderSyncContext {
  provider: ProviderStateSnapshot;
  hasProviderFeed: boolean;
  nextUpcomingProviderMatchStartsAt: string | null;
  remainingDailyRequestBudget: number;
  dailyRequestLimit: number;
}

export interface GameRuntimeRepository {
  getBootstrapPayload(userId: string): Promise<BootstrapPayload>;
  getHomePagePayload(userId: string): Promise<HomePagePayload>;
  getTeamsWithPlayers(): Promise<TeamWithPlayers[]>;
  getContestPagePayload(userId: string): Promise<ContestPagePayload>;
  getPredictionPagePayload(userId: string): Promise<PredictionPagePayload>;
  getInventoryPagePayload(userId: string): Promise<InventoryPagePayload>;
  getDashboardPayload(userId: string): Promise<DashboardPayload>;
  getVisibleContestsForUser(userId: string): Promise<Contest[]>;
  getVisibleLeaguesForUser(userId: string): Promise<League[]>;
  getPredictionFeedForUser(userId: string): Promise<PredictionFeedPayload>;
  getInventoryForUser(userId: string): Promise<{ inventory: UserInventory; cosmetics: CosmeticItem[] }>;
  getContestLeaderboardEntries(contestId: string): Promise<LeaderboardEntry[]>;
  getContestSubscriberIds(contestId: string): Promise<string[]>;
  getMatchSubscriberIds(matchId: string): Promise<string[]>;
  getLeagueMemberIds(leagueId: string): Promise<string[]>;
  getAllUserIds(): Promise<string[]>;
  getProviderStatus(): Promise<ProviderStateSnapshot>;
  getProviderSyncContext(): Promise<ProviderSyncContext>;
  reserveProviderApiRequest(limit: number, dayKey: string, blockedUntil: string): Promise<{
    used: number;
    remaining: number;
  }>;
  releaseProviderApiRequest(dayKey: string): Promise<void>;
  blockProviderApiUntil(blockedUntil: string, dayKey: string): Promise<void>;
  createLeagueRecord(userId: string, input: CreateLeagueInput): Promise<League>;
  joinLeagueByInvite(userId: string, input: JoinLeagueInput): Promise<League>;
  deleteLeagueRecord(userId: string, leagueId: string): Promise<{ leagueId: string }>;
  submitRosterRecord(
    userId: string,
    contestId: string,
    input: SubmitRosterInput | BuildRosterInput
  ): Promise<Roster>;
  answerPredictionRecord(
    userId: string,
    questionId: string,
    input: PredictionAnswerInput
  ): Promise<PredictionAnswer>;
  settlePredictionRecord(
    questionId: string,
    correctOptionId: string
  ): Promise<{ settledCount: number; correctOptionId: string }>;
  equipCosmeticRecord(userId: string, cosmeticId: string): Promise<{ cosmeticId: string }>;
  applyCorrectionRecord(
    matchId: string,
    playerId: string,
    label: string,
    points: number
  ): Promise<{ status: string }>;
  rebuildAllLeaderboards(): Promise<void>;
  applyProviderSnapshot(snapshot: ProviderSyncSnapshot): Promise<void>;
  updateProviderState(patch: Partial<ProviderStateSnapshot>): Promise<void>;
}
