import type {
  BootstrapPayload,
  BuildRosterInput,
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
  Roster,
  TeamWithPlayers,
  UserInventory
} from "@fantasy-cricket/types";
import type {
  CreateLeagueInput,
  JoinLeagueInput,
  PredictionAnswerInput,
  SubmitRosterInput
} from "@fantasy-cricket/validators";

import type { GameRuntimeRepository } from "../repositories/runtime-repository.js";
import {
  buildProviderSyncSnapshot,
  type ProviderSyncGateway,
  type ProviderSyncBuildOptions,
  type ProviderSyncResult,
  providerSyncResult
} from "./provider-sync-service.js";
import { cricketDataService } from "./cricket-data-service.js";

const MIN_PROVIDER_SYNC_REQUEST_BUDGET = 3;

export class GameService {
  private providerSyncInFlight: Promise<ProviderSyncResult> | null = null;

  constructor(
    private readonly repository: GameRuntimeRepository,
    private readonly providerGateway: ProviderSyncGateway = cricketDataService
  ) {}

  async initialize(): Promise<void> {
    await this.repository.rebuildAllLeaderboards();
  }

  async getBootstrap(userId: string): Promise<BootstrapPayload> {
    return this.repository.getBootstrapPayload(userId);
  }

  async getHomePage(userId: string): Promise<HomePagePayload> {
    return this.repository.getHomePagePayload(userId);
  }

  async getTeamsWithPlayers(): Promise<TeamWithPlayers[]> {
    return this.repository.getTeamsWithPlayers();
  }

  async getContestsPage(userId: string): Promise<ContestPagePayload> {
    return this.repository.getContestPagePayload(userId);
  }

  async getDashboard(userId: string): Promise<DashboardPayload> {
    return this.repository.getDashboardPayload(userId);
  }

  async getContests(userId: string): Promise<Contest[]> {
    return this.repository.getVisibleContestsForUser(userId);
  }

  async getLeagues(userId: string): Promise<League[]> {
    return this.repository.getVisibleLeaguesForUser(userId);
  }

  async getPredictions(userId: string): Promise<PredictionFeedPayload> {
    return this.repository.getPredictionFeedForUser(userId);
  }

  async getPredictionsPage(userId: string): Promise<PredictionPagePayload> {
    return this.repository.getPredictionPagePayload(userId);
  }

  async createLeague(userId: string, input: CreateLeagueInput): Promise<League> {
    return this.repository.createLeagueRecord(userId, input);
  }

  async joinLeague(userId: string, input: JoinLeagueInput): Promise<League> {
    return this.repository.joinLeagueByInvite(userId, input);
  }

  async deleteLeague(userId: string, leagueId: string): Promise<{ leagueId: string }> {
    return this.repository.deleteLeagueRecord(userId, leagueId);
  }

  async submitRoster(
    userId: string,
    contestId: string,
    input: SubmitRosterInput | BuildRosterInput
  ): Promise<Roster> {
    return this.repository.submitRosterRecord(userId, contestId, input);
  }

  async answerPrediction(
    userId: string,
    questionId: string,
    input: PredictionAnswerInput
  ): Promise<PredictionAnswer> {
    return this.repository.answerPredictionRecord(userId, questionId, input);
  }

  async settlePrediction(
    questionId: string,
    correctOptionId: string
  ): Promise<{ settledCount: number; correctOptionId: string }> {
    return this.repository.settlePredictionRecord(questionId, correctOptionId);
  }

  async getInventory(userId: string): Promise<{ inventory: UserInventory; cosmetics: CosmeticItem[] }> {
    return this.repository.getInventoryForUser(userId);
  }

  async getInventoryPage(userId: string): Promise<InventoryPagePayload> {
    return this.repository.getInventoryPagePayload(userId);
  }

  async getContestLeaderboard(contestId: string): Promise<LeaderboardEntry[]> {
    return this.repository.getContestLeaderboardEntries(contestId);
  }

  async equipUserCosmetic(userId: string, cosmeticId: string): Promise<{ cosmeticId: string }> {
    return this.repository.equipCosmeticRecord(userId, cosmeticId);
  }

  async applyCorrection(
    matchId: string,
    playerId: string,
    label: string,
    points: number
  ): Promise<{ status: string }> {
    return this.repository.applyCorrectionRecord(matchId, playerId, label, points);
  }

  async syncProvider(): Promise<ProviderSyncResult> {
    if (this.providerSyncInFlight) {
      return this.providerSyncInFlight;
    }

    this.providerSyncInFlight = (async () => {
      const context = await this.repository.getProviderSyncContext();
      if (
        context.provider.blockedUntil &&
        new Date(context.provider.blockedUntil).getTime() > Date.now()
      ) {
        throw new Error(`Provider sync is blocked until ${context.provider.blockedUntil}.`);
      }

      if (context.remainingDailyRequestBudget < MIN_PROVIDER_SYNC_REQUEST_BUDGET) {
        throw new Error("Not enough CricAPI daily budget remains to run a safe sync.");
      }

      const buildOptions: ProviderSyncBuildOptions = {
        maxProviderRequests: context.remainingDailyRequestBudget
      };
      const snapshot = await buildProviderSyncSnapshot(
        this.providerGateway,
        new Date().getFullYear(),
        buildOptions
      );
      if (snapshot.matches.length === 0) {
        throw new Error("Provider sync returned no matches. Existing provider data was preserved.");
      }

      await this.repository.applyProviderSnapshot(snapshot);
      return providerSyncResult(snapshot);
    })().finally(() => {
      this.providerSyncInFlight = null;
    });

    return this.providerSyncInFlight;
  }

  async getProviderStatus() {
    return this.repository.getProviderStatus();
  }

  async getProviderSyncContext() {
    return this.repository.getProviderSyncContext();
  }

  async contestSubscriberIds(contestId: string): Promise<string[]> {
    return this.repository.getContestSubscriberIds(contestId);
  }

  async matchSubscriberIds(matchId: string): Promise<string[]> {
    return this.repository.getMatchSubscriberIds(matchId);
  }

  async leagueMemberIds(leagueId: string): Promise<string[]> {
    return this.repository.getLeagueMemberIds(leagueId);
  }

  async allUserIds(): Promise<string[]> {
    return this.repository.getAllUserIds();
  }
}
