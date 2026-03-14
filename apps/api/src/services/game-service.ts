import { createInviteCode, createLeagueBanner, equipCosmetic, unlockCosmetic, validateRoster } from "@fantasy-cricket/domain";
import { calculateRosterPoints, canSubmitPrediction } from "@fantasy-cricket/scoring";
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

export class GameService {
  constructor(private readonly store: AppStore) {
    this.recomputeAllLeaderboards();
  }

  getUser(userId: string): User {
    const user = this.store.users.find((entry) => entry.id === userId);
    if (!user) {
      throw new Error("Unknown user.");
    }

    return user;
  }

  getProfile(userId: string): Profile {
    const profile = this.store.profiles.find((entry) => entry.userId === userId);
    if (!profile) {
      throw new Error("Unknown profile.");
    }

    return profile;
  }

  getInventoryRecord(userId: string): UserInventory {
    const inventory = this.store.inventories.find((entry) => entry.userId === userId);
    if (!inventory) {
      throw new Error("Inventory not found.");
    }

    return inventory;
  }

  private generatePlayerStats(): PlayerStats[] {
    return this.store.players.map((player) => ({
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
      form: player.rating > 88 ? "hot" : player.rating > 82 ? "good" : player.rating > 78 ? "average" : "cold"
    }));
  }

  getDashboard(userId: string): DashboardPayload {
    const user = this.getUser(userId);
    const inventory = this.getInventoryRecord(userId);

    return {
      user,
      profile: this.getProfile(userId),
      contests: this.store.contests,
      leagues: this.store.leagues.filter(
        (league) => league.visibility === "public" || league.memberIds.includes(userId)
      ),
      matches: this.store.matches,
      teams: this.store.teams,
      players: this.store.players,
      playerStats: this.generatePlayerStats(),
      rosters: this.store.rosters.filter((roster) => roster.userId === userId || this.isPublicContest(roster.contestId)),
      leaderboard: this.store.leaderboard,
      questions: this.store.questions,
      answers: this.store.answers.filter((answer) => answer.userId === userId),
      results: this.store.results.filter((result) => result.userId === userId),
      inventory,
      cosmetics: this.store.cosmetics,
      badges: this.store.badges,
      xpTransactions: this.store.xpTransactions.filter((entry) => entry.userId === userId)
    };
  }

  createLeague(userId: string, input: CreateLeagueInput): League {
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

    this.store.leagues.push(league);
    this.store.invites.push({
      id: crypto.randomUUID(),
      leagueId: league.id,
      code: league.inviteCode,
      createdBy: userId,
      createdAt: new Date().toISOString()
    });

    return league;
  }

  joinLeague(userId: string, input: JoinLeagueInput): League {
    const league = this.store.leagues.find((entry) => entry.inviteCode === input.inviteCode);
    if (!league) {
      throw new Error("Invite code is invalid.");
    }

    if (!league.memberIds.includes(userId)) {
      league.memberIds.push(userId);
    }

    return league;
  }

  submitRoster(userId: string, contestId: string, input: SubmitRosterInput | BuildRosterInput): Roster {
    const contest = this.store.contests.find((entry) => entry.id === contestId);
    if (!contest) {
      throw new Error("Contest not found.");
    }

    const match = this.getMatch(contest.matchId);
    const matchPlayers = this.playersForMatch(match);
    const validation = validateRoster(contest, match, matchPlayers, input, new Date());

    if (!validation.valid) {
      throw new Error(validation.errors.join(" "));
    }

    const existing = this.store.rosters.find((entry) => entry.contestId === contestId && entry.userId === userId);
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
      this.store.rosters.push(roster);
    }

    this.recomputeContestLeaderboard(contest);
    return roster;
  }

  answerPrediction(userId: string, questionId: string, input: PredictionAnswerInput): PredictionAnswer {
    const question = this.getQuestion(questionId);
    if (!canSubmitPrediction(question)) {
      throw new Error("Prediction is locked.");
    }

    const option = question.options.find((entry) => entry.id === input.optionId);
    if (!option) {
      throw new Error("Prediction option not found.");
    }

    const existing = this.store.answers.find((entry) => entry.questionId === questionId && entry.userId === userId);
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
      this.store.answers.push(answer);
    }

    return answer;
  }

  getInventory(userId: string): { inventory: UserInventory; cosmetics: CosmeticItem[] } {
    const inventory = this.getInventoryRecord(userId);

    return {
      inventory,
      cosmetics: this.store.cosmetics.filter((item) => inventory.cosmeticIds.includes(item.id))
    };
  }

  equipUserCosmetic(userId: string, cosmeticId: string): { cosmeticId: string } {
    const inventory = this.getInventoryRecord(userId);
    const profile = this.getProfile(userId);
    const item = this.store.cosmetics.find((entry) => entry.id === cosmeticId);

    if (!item) {
      throw new Error("Cosmetic not found.");
    }

    const updated = equipCosmetic(inventory, profile, item);
    Object.assign(inventory, updated.inventory);
    Object.assign(profile, updated.profile);

    return { cosmeticId };
  }

  unlockCosmeticForUser(userId: string, cosmeticId: string, source: "prediction" | "seasonal" | "admin") {
    const inventory = this.getInventoryRecord(userId);
    const item = this.store.cosmetics.find((entry) => entry.id === cosmeticId);
    if (!item) {
      throw new Error("Cosmetic not found.");
    }

    const updated = unlockCosmetic(inventory, userId, item, source, new Date().toISOString());
    Object.assign(inventory, updated.inventory);
    if (updated.unlock) {
      this.store.cosmeticUnlocks.push(updated.unlock);
    }
  }

  applyCorrection(matchId: string, playerId: string, label: string, points: number): { status: string } {
    const match = this.getMatch(matchId);
    this.store.scoreEvents.push({
      id: crypto.randomUUID(),
      matchId: match.id,
      playerId,
      label,
      points,
      createdAt: new Date().toISOString()
    });

    this.store.contests
      .filter((contest) => contest.matchId === match.id)
      .forEach((contest) => this.recomputeContestLeaderboard(contest));

    return { status: "corrected" };
  }

  syncProvider(): { status: string; syncedAt: string } {
    this.store.provider = {
      status: "ready",
      syncedAt: new Date().toISOString()
    };

    return this.store.provider;
  }

  private getMatch(matchId: string): Match {
    const match = this.store.matches.find((entry) => entry.id === matchId);
    if (!match) {
      throw new Error("Match not found.");
    }

    return match;
  }

  private getQuestion(questionId: string): PredictionQuestion {
    const question = this.store.questions.find((entry) => entry.id === questionId);
    if (!question) {
      throw new Error("Prediction question not found.");
    }

    return question;
  }

  private playersForMatch(match: Match): Player[] {
    return this.store.players.filter(
      (player) => player.teamId === match.homeTeamId || player.teamId === match.awayTeamId
    );
  }

  private scoreEventsForContest(contest: Contest): FantasyScoreEvent[] {
    return this.store.scoreEvents.filter((event) => event.matchId === contest.matchId);
  }

  private isPublicContest(contestId: string): boolean {
    return this.store.contests.some((contest) => contest.id === contestId && contest.kind === "public");
  }

  private recomputeAllLeaderboards() {
    this.store.contests.forEach((contest) => this.recomputeContestLeaderboard(contest));
  }

  private recomputeContestLeaderboard(contest: Contest) {
    const players = this.playersForMatch(this.getMatch(contest.matchId));
    const events = this.scoreEventsForContest(contest);

    const previousLeaderboard = this.store.leaderboard.filter((entry) => entry.contestId === contest.id);
    const previousRanks = new Map(previousLeaderboard.map((entry) => [entry.userId, entry.rank]));

    const ranked = this.store.rosters
      .filter((roster) => roster.contestId === contest.id)
      .map((roster) => ({
        roster,
        score: calculateRosterPoints(roster, players, events).total
      }))
      .sort((left, right) => right.score - left.score);

    const withoutContest = this.store.leaderboard.filter((entry) => entry.contestId !== contest.id);
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

    this.store.leaderboard = [...withoutContest, ...nextEntries];
  }
}