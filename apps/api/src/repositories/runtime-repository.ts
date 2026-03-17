import type {
  BuildRosterInput,
  AuthResponse,
  Contest,
  CosmeticItem,
  DashboardPayload,
  LeaderboardEntry,
  League,
  PredictionAnswer,
  PredictionFeedPayload,
  Profile,
  Roster,
  User,
  UserInventory
} from "@fantasy-cricket/types";
import type {
  CreateLeagueInput,
  JoinLeagueInput,
  PredictionAnswerInput,
  SubmitRosterInput
} from "@fantasy-cricket/validators";

import type { AppStore } from "../data/store.js";
import type { ProviderSyncSnapshot } from "../services/provider-sync-service.js";

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
  provider: AppStore["provider"];
  hasProviderFeed: boolean;
  nextUpcomingProviderMatchStartsAt: string | null;
}

export interface GameRuntimeRepository {
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
  getProviderStatus(): Promise<AppStore["provider"]>;
  getProviderSyncContext(): Promise<ProviderSyncContext>;
  createLeagueRecord(userId: string, input: CreateLeagueInput): Promise<League>;
  joinLeagueByInvite(userId: string, input: JoinLeagueInput): Promise<League>;
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
  updateProviderState(patch: Partial<AppStore["provider"]>): Promise<void>;
}
