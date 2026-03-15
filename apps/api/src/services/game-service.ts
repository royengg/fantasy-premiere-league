import {
  createInviteCode,
  createLeagueBanner,
  equipCosmetic,
  levelFromXp,
  unlockCosmetic,
  validateRoster
} from "@fantasy-cricket/domain";
import {
  calculateRosterPoints,
  canSubmitPrediction,
  settlePredictionAnswer
} from "@fantasy-cricket/scoring";
import type {
  BuildRosterInput,
  Contest,
  CosmeticItem,
  DashboardPayload,
  FantasyScoreEvent,
  LeaderboardEntry,
  League,
  Match,
  Player,
  PlayerStats,
  PredictionAnswer,
  PredictionQuestion,
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
import type { AppRepository } from "../repositories/app-repository.js";

export class GameService {
  constructor(private readonly repository: AppRepository) {}

  async initialize(): Promise<void> {
    const store = await this.repository.loadStore();
    this.recomputeAllLeaderboards(store);
    await this.repository.replaceStore(store);
  }

  async getDashboard(userId: string): Promise<DashboardPayload> {
    return this.read((store) => {
      const user = this.getUser(store, userId);
      const inventory = this.getInventoryRecord(store, userId);

      return {
        user,
        profile: this.getProfile(store, userId),
        contests: store.contests,
        leagues: store.leagues.filter(
          (league) => league.visibility === "public" || league.memberIds.includes(userId)
        ),
        matches: store.matches,
        teams: store.teams,
        players: store.players,
        playerStats: this.generatePlayerStats(store),
        rosters: store.rosters.filter(
          (roster) => roster.userId === userId || this.isPublicContest(store, roster.contestId)
        ),
        leaderboard: store.leaderboard,
        questions: store.questions,
        answers: store.answers.filter((answer) => answer.userId === userId),
        results: store.results.filter((result) => result.userId === userId),
        inventory,
        cosmetics: store.cosmetics,
        badges: store.badges,
        xpTransactions: store.xpTransactions.filter((entry) => entry.userId === userId)
      };
    });
  }

  async createLeague(userId: string, input: CreateLeagueInput): Promise<League> {
    return this.write((store) => {
      const league: League = {
        id: crypto.randomUUID(),
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        createdBy: userId,
        inviteCode: createInviteCode(input.name),
        memberIds: [userId],
        contestIds: [],
        bannerStyle: createLeagueBanner(input.visibility)
      };

      store.leagues.push(league);
      store.invites.push({
        id: crypto.randomUUID(),
        leagueId: league.id,
        code: league.inviteCode,
        createdBy: userId,
        createdAt: new Date().toISOString()
      });

      return league;
    });
  }

  async joinLeague(userId: string, input: JoinLeagueInput): Promise<League> {
    return this.write((store) => {
      const league = store.leagues.find((entry) => entry.inviteCode === input.inviteCode);
      if (!league) {
        throw new Error("Invite code is invalid.");
      }

      if (!league.memberIds.includes(userId)) {
        league.memberIds.push(userId);
      }

      return league;
    });
  }

  async submitRoster(
    userId: string,
    contestId: string,
    input: SubmitRosterInput | BuildRosterInput
  ): Promise<Roster> {
    return this.write((store) => {
      const contest = store.contests.find((entry) => entry.id === contestId);
      if (!contest) {
        throw new Error("Contest not found.");
      }

      const match = this.getMatch(store, contest.matchId);
      const matchPlayers = this.playersForMatch(store, match);
      const validation = validateRoster(contest, match, matchPlayers, input, new Date());

      if (!validation.valid) {
        throw new Error(validation.errors.join(" "));
      }

      const existing = store.rosters.find(
        (entry) => entry.contestId === contestId && entry.userId === userId
      );
      const roster: Roster = {
        id: existing?.id ?? crypto.randomUUID(),
        contestId,
        userId,
        players: input.playerIds.map((playerId) => ({ playerId })),
        captainPlayerId: input.captainPlayerId,
        viceCaptainPlayerId: input.viceCaptainPlayerId,
        totalCredits: validation.totalCredits,
        submittedAt: new Date().toISOString(),
        locked: new Date() >= new Date(contest.lockTime),
        hasUncappedPlayer: validation.hasUncappedPlayer
      };

      if (existing) {
        Object.assign(existing, roster);
      } else {
        store.rosters.push(roster);
      }

      this.recomputeContestLeaderboard(store, contest);
      return roster;
    });
  }

  async answerPrediction(
    userId: string,
    questionId: string,
    input: PredictionAnswerInput
  ): Promise<PredictionAnswer> {
    return this.write((store) => {
      const question = this.getQuestion(store, questionId);
      if (!canSubmitPrediction(question)) {
        throw new Error("Prediction is locked.");
      }

      const option = question.options.find((entry) => entry.id === input.optionId);
      if (!option) {
        throw new Error("Prediction option not found.");
      }

      const existing = store.answers.find(
        (entry) => entry.questionId === questionId && entry.userId === userId
      );
      const answer: PredictionAnswer = {
        id: existing?.id ?? crypto.randomUUID(),
        questionId,
        userId,
        optionId: input.optionId,
        submittedAt: new Date().toISOString()
      };

      if (existing) {
        Object.assign(existing, answer);
      } else {
        store.answers.push(answer);
      }

      return answer;
    });
  }

  async settlePrediction(
    questionId: string,
    correctOptionId: string
  ): Promise<{ settledCount: number; correctOptionId: string }> {
    return this.write((store) => {
      const question = this.getQuestion(store, questionId);
      if (question.state === "settled") {
        throw new Error("Prediction already settled.");
      }

      const option = question.options.find((entry) => entry.id === correctOptionId);
      if (!option) {
        throw new Error("Prediction option not found.");
      }

      question.state = "settled";
      const settledAt = new Date().toISOString();
      const answers = store.answers.filter((entry) => entry.questionId === questionId);

      for (const answer of answers) {
        const profile = this.getProfile(store, answer.userId);
        const inventory = this.getInventoryRecord(store, answer.userId);
        const settled = settlePredictionAnswer(
          question,
          answer,
          correctOptionId,
          profile.streak,
          settledAt
        );

        store.results.push(settled.result);
        store.xpTransactions.push(settled.transaction);

        profile.xp += settled.result.awardedXp;
        profile.level = levelFromXp(profile.xp);
        profile.streak = settled.result.streak;

        if (
          settled.result.awardedBadgeId &&
          !inventory.badgeIds.includes(settled.result.awardedBadgeId)
        ) {
          inventory.badgeIds.push(settled.result.awardedBadgeId);
        }

        if (settled.result.awardedCosmeticId) {
          this.unlockCosmeticForUserInStore(
            store,
            answer.userId,
            settled.result.awardedCosmeticId,
            "prediction"
          );
        }
      }

      return {
        settledCount: answers.length,
        correctOptionId
      };
    });
  }

  async getInventory(userId: string): Promise<{ inventory: UserInventory; cosmetics: CosmeticItem[] }> {
    return this.read((store) => {
      const inventory = this.getInventoryRecord(store, userId);

      return {
        inventory,
        cosmetics: store.cosmetics.filter((item) => inventory.cosmeticIds.includes(item.id))
      };
    });
  }

  async equipUserCosmetic(userId: string, cosmeticId: string): Promise<{ cosmeticId: string }> {
    return this.write((store) => {
      const inventory = this.getInventoryRecord(store, userId);
      const profile = this.getProfile(store, userId);
      const item = store.cosmetics.find((entry) => entry.id === cosmeticId);

      if (!item) {
        throw new Error("Cosmetic not found.");
      }

      const updated = equipCosmetic(inventory, profile, item);
      Object.assign(inventory, updated.inventory);
      Object.assign(profile, updated.profile);

      return { cosmeticId };
    });
  }

  async applyCorrection(
    matchId: string,
    playerId: string,
    label: string,
    points: number
  ): Promise<{ status: string }> {
    return this.write((store) => {
      const match = this.getMatch(store, matchId);
      store.scoreEvents.push({
        id: crypto.randomUUID(),
        matchId: match.id,
        playerId,
        label,
        points,
        createdAt: new Date().toISOString()
      });

      store.contests
        .filter((contest) => contest.matchId === match.id)
        .forEach((contest) => this.recomputeContestLeaderboard(store, contest));

      return { status: "corrected" };
    });
  }

  async syncProvider(): Promise<{ status: string; syncedAt: string }> {
    return this.write((store) => {
      store.provider = {
        status: "ready",
        syncedAt: new Date().toISOString()
      };

      return store.provider;
    });
  }

  async getProviderStatus(): Promise<AppStore["provider"]> {
    return this.read((store) => store.provider);
  }

  async contestSubscriberIds(contestId: string): Promise<string[]> {
    return this.read((store) => this.contestSubscriberIdsFromStore(store, contestId));
  }

  async matchSubscriberIds(matchId: string): Promise<string[]> {
    return this.read((store) => {
      const userIds = new Set<string>();

      store.contests
        .filter((contest) => contest.matchId === matchId)
        .forEach((contest) => {
          this.contestSubscriberIdsFromStore(store, contest.id).forEach((userId) => userIds.add(userId));
        });

      return [...userIds];
    });
  }

  async leagueMemberIds(leagueId: string): Promise<string[]> {
    return this.read((store) => {
      const league = store.leagues.find((entry) => entry.id === leagueId);
      if (!league) {
        throw new Error("League not found.");
      }

      return [...league.memberIds];
    });
  }

  async allUserIds(): Promise<string[]> {
    return this.read((store) => store.users.map((user) => user.id));
  }

  private async read<T>(reader: (store: AppStore) => T): Promise<T> {
    const store = await this.repository.loadStore();
    return reader(store);
  }

  private async write<T>(writer: (store: AppStore) => T): Promise<T> {
    const store = await this.repository.loadStore();
    const result = writer(store);
    await this.repository.replaceStore(store);
    return result;
  }

  private getUser(store: AppStore, userId: string): User {
    const user = store.users.find((entry) => entry.id === userId);
    if (!user) {
      throw new Error("Unknown user.");
    }

    return user;
  }

  private getProfile(store: AppStore, userId: string): Profile {
    const profile = store.profiles.find((entry) => entry.userId === userId);
    if (!profile) {
      throw new Error("Unknown profile.");
    }

    return profile;
  }

  private getInventoryRecord(store: AppStore, userId: string): UserInventory {
    const inventory = store.inventories.find((entry) => entry.userId === userId);
    if (!inventory) {
      throw new Error("Inventory not found.");
    }

    return inventory;
  }

  private generatePlayerStats(store: AppStore): PlayerStats[] {
    return store.players.map((player) => ({
      playerId: player.id,
      lastFiveMatches: [
        Math.floor(Math.random() * 50) + 5,
        Math.floor(Math.random() * 50) + 5,
        Math.floor(Math.random() * 50) + 5,
        Math.floor(Math.random() * 50) + 5,
        Math.floor(Math.random() * 50) + 5
      ],
      totalPoints: Math.floor(Math.random() * 500) + 100,
      averagePoints: Math.floor(Math.random() * 30) + 10,
      highestScore: Math.floor(Math.random() * 100) + 30,
      vsTeam: {},
      venueRecord: {},
      form:
        player.rating > 88
          ? "hot"
          : player.rating > 82
            ? "good"
            : player.rating > 78
              ? "average"
              : "cold"
    }));
  }

  private unlockCosmeticForUserInStore(
    store: AppStore,
    userId: string,
    cosmeticId: string,
    source: "prediction" | "seasonal" | "admin"
  ) {
    const inventory = this.getInventoryRecord(store, userId);
    const item = store.cosmetics.find((entry) => entry.id === cosmeticId);
    if (!item) {
      throw new Error("Cosmetic not found.");
    }

    const updated = unlockCosmetic(inventory, userId, item, source, new Date().toISOString());
    Object.assign(inventory, updated.inventory);
    if (updated.unlock) {
      store.cosmeticUnlocks.push(updated.unlock);
    }
  }

  private contestSubscriberIdsFromStore(store: AppStore, contestId: string): string[] {
    const contest = store.contests.find((entry) => entry.id === contestId);
    if (!contest) {
      throw new Error("Contest not found.");
    }

    const userIds = new Set(
      store.rosters.filter((roster) => roster.contestId === contestId).map((roster) => roster.userId)
    );

    if (contest.kind === "public") {
      store.users.forEach((user) => userIds.add(user.id));
    }

    if (contest.leagueId) {
      const league = store.leagues.find((entry) => entry.id === contest.leagueId);
      league?.memberIds.forEach((userId) => userIds.add(userId));
    }

    return [...userIds];
  }

  private getMatch(store: AppStore, matchId: string): Match {
    const match = store.matches.find((entry) => entry.id === matchId);
    if (!match) {
      throw new Error("Match not found.");
    }

    return match;
  }

  private getQuestion(store: AppStore, questionId: string): PredictionQuestion {
    const question = store.questions.find((entry) => entry.id === questionId);
    if (!question) {
      throw new Error("Prediction question not found.");
    }

    return question;
  }

  private playersForMatch(store: AppStore, match: Match): Player[] {
    return store.players.filter(
      (player) => player.teamId === match.homeTeamId || player.teamId === match.awayTeamId
    );
  }

  private scoreEventsForContest(store: AppStore, contest: Contest): FantasyScoreEvent[] {
    return store.scoreEvents.filter((event) => event.matchId === contest.matchId);
  }

  private isPublicContest(store: AppStore, contestId: string): boolean {
    return store.contests.some((contest) => contest.id === contestId && contest.kind === "public");
  }

  private recomputeAllLeaderboards(store: AppStore) {
    store.contests.forEach((contest) => this.recomputeContestLeaderboard(store, contest));
  }

  private recomputeContestLeaderboard(store: AppStore, contest: Contest) {
    const players = this.playersForMatch(store, this.getMatch(store, contest.matchId));
    const events = this.scoreEventsForContest(store, contest);

    const previousLeaderboard = store.leaderboard.filter((entry) => entry.contestId === contest.id);
    const previousRanks = new Map(previousLeaderboard.map((entry) => [entry.userId, entry.rank]));

    const ranked = store.rosters
      .filter((roster) => roster.contestId === contest.id)
      .map((roster) => ({
        roster,
        score: calculateRosterPoints(roster, players, events).total
      }))
      .sort((left, right) => right.score - left.score);

    const withoutContest = store.leaderboard.filter((entry) => entry.contestId !== contest.id);
    const nextEntries: LeaderboardEntry[] = ranked.map(({ roster, score }, index) => {
      const currentRank = index + 1;
      const prevRank = previousRanks.get(roster.userId) ?? currentRank;

      return {
        id: `${contest.id}-${roster.userId}`,
        contestId: contest.id,
        userId: roster.userId,
        points: score,
        rank: currentRank,
        previousRank: prevRank,
        trend: currentRank < prevRank ? "up" : currentRank > prevRank ? "down" : "steady"
      };
    });

    store.leaderboard = [...withoutContest, ...nextEntries];
  }
}
