import type {
  BuildRosterInput,
  Contest,
  CosmeticItem,
  DashboardPayload,
  LeaderboardEntry,
  League,
  PredictionAnswer,
  PredictionFeedPayload,
  Roster,
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
  type ProviderSyncResult,
  providerSyncResult
} from "./provider-sync-service.js";
import { cricketDataService } from "./cricket-data-service.js";

export class GameService {
  constructor(
    private readonly repository: GameRuntimeRepository,
    private readonly providerGateway: ProviderSyncGateway = cricketDataService
  ) {}

  async initialize(): Promise<void> {
    await this.repository.rebuildAllLeaderboards();
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

  async createLeague(userId: string, input: CreateLeagueInput): Promise<League> {
    return this.repository.createLeagueRecord(userId, input);
  }

  async joinLeague(userId: string, input: JoinLeagueInput): Promise<League> {
    return this.repository.joinLeagueByInvite(userId, input);
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
    const snapshot = await buildProviderSyncSnapshot(this.providerGateway);
    if (snapshot.matches.length === 0) {
      throw new Error("Provider sync returned no matches. Existing provider data was preserved.");
    }

    await this.repository.applyProviderSnapshot(snapshot);
    return providerSyncResult(snapshot);
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
