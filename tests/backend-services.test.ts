import { describe, expect, it } from "vitest";

import {
  createInviteCode,
  createLeagueBanner,
  defaultRosterRules,
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
  LeaderboardEntry,
  League,
  Match,
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

import { createBootstrapStore } from "../apps/api/src/data/seed.ts";
import type { AppStore } from "../apps/api/src/data/store.ts";
import { AuthService } from "../apps/api/src/services/auth-service.ts";
import { GameService } from "../apps/api/src/services/game-service.ts";
import type { ProviderSyncGateway } from "../apps/api/src/services/provider-sync-service.ts";
import type {
  AuthRuntimeRepository,
  GameRuntimeRepository
} from "../apps/api/src/repositories/runtime-repository.ts";
import { createDemoSeedStore } from "./helpers/demo-store.ts";

function cloneStore(store: AppStore): AppStore {
  return structuredClone(store);
}

function isProviderManagedId(id: string) {
  return id.startsWith("provider:");
}

function preferredQuestions(questions: AppStore["questions"]) {
  const providerQuestions = questions.filter((question) => isProviderManagedId(question.id));
  return providerQuestions.length > 0
    ? providerQuestions
    : questions.filter((question) => !isProviderManagedId(question.id));
}

function preferredPublicContests(store: AppStore) {
  const providerMatchesPresent = store.matches.some((match) => isProviderManagedId(match.id));
  const publicContests = store.contests.filter((contest) => contest.kind === "public");

  if (providerMatchesPresent) {
    return publicContests.filter((contest) => isProviderManagedId(contest.id));
  }

  const providerManagedPublic = publicContests.filter((contest) => isProviderManagedId(contest.id));
  if (providerManagedPublic.length > 0) {
    return providerManagedPublic;
  }

  return publicContests.filter((contest) => !isProviderManagedId(contest.id));
}

function buildContestLeaderboard(store: AppStore, contest: Contest): LeaderboardEntry[] {
  const match = store.matches.find((entry) => entry.id === contest.matchId);
  if (!match) {
    return [];
  }

  const players = store.players.filter(
    (player) => player.teamId === match.homeTeamId || player.teamId === match.awayTeamId
  );
  const events = store.scoreEvents.filter((event) => event.matchId === contest.matchId);
  const previousRanks = new Map(
    store.leaderboard
      .filter((entry) => entry.contestId === contest.id)
      .map((entry) => [entry.userId, entry.rank])
  );

  return store.rosters
    .filter((roster) => roster.contestId === contest.id)
    .map((roster) => ({
      roster,
      score: calculateRosterPoints(roster, players, events).total
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ roster, score }, index) => {
      const rank = index + 1;
      const previousRank = previousRanks.get(roster.userId) ?? rank;
      return {
        id: `${contest.id}-${roster.userId}`,
        contestId: contest.id,
        userId: roster.userId,
        points: score,
        rank,
        previousRank,
        trend: rank < previousRank ? "up" : rank > previousRank ? "down" : "steady"
      };
    });
}

class TestRuntimeRepository implements AuthRuntimeRepository, GameRuntimeRepository {
  private store: AppStore;

  constructor(store: AppStore) {
    this.store = cloneStore(store);
  }

  getStore() {
    return cloneStore(this.store);
  }

  async initialize(seedStore: AppStore): Promise<void> {
    if (!this.store.users.length) {
      this.store = cloneStore(seedStore);
    }
  }

  async listProfileUsernamesByBase(baseUsername: string): Promise<string[]> {
    return this.store.profiles
      .filter((profile) => profile.username.toLowerCase().startsWith(baseUsername.toLowerCase()))
      .map((profile) => profile.username);
  }

  async findUserLoginRecord(email: string) {
    const user = this.store.users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return null;
    }

    const profile = this.store.profiles.find((entry) => entry.userId === user.id);
    const credential = this.store.credentials.find((entry) => entry.userId === user.id);
    if (!profile || !credential) {
      return null;
    }

    return {
      user,
      profile,
      passwordHash: credential.passwordHash
    };
  }

  async createRegisteredUserRecord(payload: {
    user: User;
    profile: Profile;
    passwordHash: string;
    sessionHash: string;
    sessionCreatedAt: string;
    sessionExpiresAt: string;
  }): Promise<void> {
    this.store.users.push(payload.user);
    this.store.profiles.push(payload.profile);
    this.store.credentials.push({
      userId: payload.user.id,
      passwordHash: payload.passwordHash,
      updatedAt: payload.sessionCreatedAt
    });
    this.store.sessions.push({
      token: payload.sessionHash,
      userId: payload.user.id,
      createdAt: payload.sessionCreatedAt,
      expiresAt: payload.sessionExpiresAt
    });
    this.store.inventories.push({
      userId: payload.user.id,
      cosmeticIds: [],
      badgeIds: [],
      equipped: {}
    });
  }

  async createHashedSession(payload: {
    userId: string;
    sessionHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<void> {
    this.store.sessions.push({
      token: payload.sessionHash,
      userId: payload.userId,
      createdAt: payload.createdAt,
      expiresAt: payload.expiresAt
    });
  }

  async hasAnyAdminUser(): Promise<boolean> {
    return this.store.users.some((user) => user.isAdmin);
  }

  async completeOnboardingProfile(payload: {
    userId: string;
    username: string;
    favoriteTeamId: string;
  }): Promise<Profile> {
    const team = this.store.teams.find((entry) => entry.id === payload.favoriteTeamId);
    if (!team) {
      throw new Error("Favorite team not found.");
    }

    const duplicate = this.store.profiles.find(
      (profile) =>
        profile.userId !== payload.userId &&
        profile.username.toLowerCase() === payload.username.toLowerCase()
    );
    if (duplicate) {
      throw new Error("Username is already taken.");
    }

    const profile = this.store.profiles.find((entry) => entry.userId === payload.userId);
    if (!profile) {
      throw new Error("Profile is missing.");
    }

    profile.username = payload.username;
    profile.favoriteTeamId = payload.favoriteTeamId;
    profile.onboardingCompleted = true;
    return structuredClone(profile);
  }

  async findActiveSessionUserId(sessionHash: string, now: string): Promise<string | null> {
    this.store.sessions = this.store.sessions.filter(
      (session) => new Date(session.expiresAt).getTime() > new Date(now).getTime()
    );
    return this.store.sessions.find((session) => session.token === sessionHash)?.userId ?? null;
  }

  async deleteSessionByHash(sessionHash: string): Promise<void> {
    this.store.sessions = this.store.sessions.filter((session) => session.token !== sessionHash);
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    return this.store.users.find((user) => user.id === userId)?.isAdmin ?? false;
  }

  async getDashboardPayload(userId: string): Promise<DashboardPayload> {
    const contests = await this.getVisibleContestsForUser(userId);
    const leagues = await this.getVisibleLeaguesForUser(userId);
    const predictionFeed = await this.getPredictionFeedForUser(userId);
    const contestIds = new Set(contests.map((contest) => contest.id));
    const matchIds = new Set([
      ...contests.map((contest) => contest.matchId),
      ...predictionFeed.questions.map((question) => question.matchId)
    ]);
    const matches = this.store.matches.filter((match) => matchIds.has(match.id));
    const teamIds = new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]));
    const teams = this.store.teams.filter((team) => teamIds.has(team.id));
    const players = this.store.players.filter((player) => teamIds.has(player.teamId));
    const inventory = this.store.inventories.find((entry) => entry.userId === userId);
    const user = this.store.users.find((entry) => entry.id === userId);
    const profile = this.store.profiles.find((entry) => entry.userId === userId);

    if (!inventory) {
      throw new Error("Inventory not found.");
    }
    if (!user) {
      throw new Error("Unknown user.");
    }
    if (!profile) {
      throw new Error("Unknown profile.");
    }

    return {
      user,
      profile,
      contests,
      leagues,
      matches,
      teams,
      players,
      rosters: this.store.rosters.filter(
        (roster) =>
          contestIds.has(roster.contestId) &&
          (roster.userId === userId ||
            contests.some((contest) => contest.id === roster.contestId && contest.kind === "public"))
      ),
      leaderboard: this.store.leaderboard.filter((entry) => contestIds.has(entry.contestId)),
      questions: predictionFeed.questions,
      answers: predictionFeed.answers,
      inventory,
      cosmetics: this.store.cosmetics,
      badges: this.store.badges
    };
  }

  async getVisibleContestsForUser(userId: string): Promise<Contest[]> {
    const privateContestIds = new Set(
      this.store.leagues
        .filter((league) => league.visibility === "public" || league.memberIds.includes(userId))
        .flatMap((league) => league.contestIds)
    );

    return [
      ...preferredPublicContests(this.store),
      ...this.store.contests.filter(
        (contest) => contest.kind === "private" && privateContestIds.has(contest.id)
      )
    ];
  }

  async getVisibleLeaguesForUser(userId: string): Promise<League[]> {
    return this.store.leagues.filter(
      (league) => league.visibility === "public" || league.memberIds.includes(userId)
    );
  }

  async getPredictionFeedForUser(userId: string): Promise<PredictionFeedPayload> {
    const questions = preferredQuestions(this.store.questions);
    const questionIds = new Set(questions.map((question) => question.id));

    return {
      questions,
      answers: this.store.answers.filter(
        (answer) => answer.userId === userId && questionIds.has(answer.questionId)
      ),
      results: this.store.results.filter(
        (result) => result.userId === userId && questionIds.has(result.questionId)
      )
    };
  }

  async getInventoryForUser(userId: string): Promise<{ inventory: UserInventory; cosmetics: CosmeticItem[] }> {
    const inventory = this.store.inventories.find((entry) => entry.userId === userId);
    if (!inventory) {
      throw new Error("Inventory not found.");
    }

    return {
      inventory,
      cosmetics: this.store.cosmetics.filter((item) => inventory.cosmeticIds.includes(item.id))
    };
  }

  async getContestLeaderboardEntries(contestId: string): Promise<LeaderboardEntry[]> {
    return this.store.leaderboard.filter((entry) => entry.contestId === contestId);
  }

  async getContestSubscriberIds(contestId: string): Promise<string[]> {
    const contest = this.store.contests.find((entry) => entry.id === contestId);
    if (!contest) {
      throw new Error("Contest not found.");
    }

    const userIds = new Set(
      this.store.rosters.filter((roster) => roster.contestId === contestId).map((roster) => roster.userId)
    );

    if (contest.kind === "public") {
      this.store.users.forEach((user) => userIds.add(user.id));
    }

    if (contest.leagueId) {
      this.store.leagues
        .find((league) => league.id === contest.leagueId)
        ?.memberIds.forEach((userId) => userIds.add(userId));
    }

    return [...userIds];
  }

  async getMatchSubscriberIds(matchId: string): Promise<string[]> {
    const userIds = new Set<string>();
    for (const contest of this.store.contests.filter((entry) => entry.matchId === matchId)) {
      (await this.getContestSubscriberIds(contest.id)).forEach((userId) => userIds.add(userId));
    }
    return [...userIds];
  }

  async getLeagueMemberIds(leagueId: string): Promise<string[]> {
    const league = this.store.leagues.find((entry) => entry.id === leagueId);
    if (!league) {
      throw new Error("League not found.");
    }

    return [...league.memberIds];
  }

  async getAllUserIds(): Promise<string[]> {
    return this.store.users.map((user) => user.id);
  }

  async getProviderStatus(): Promise<AppStore["provider"]> {
    return structuredClone(this.store.provider);
  }

  async getProviderSyncContext() {
    const nextUpcomingProviderMatch = this.store.matches
      .filter(
        (match) =>
          isProviderManagedId(match.id) &&
          match.state === "scheduled" &&
          new Date(match.startsAt).getTime() > Date.now()
      )
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
      )[0];

    return {
      provider: structuredClone(this.store.provider),
      hasProviderFeed: this.store.matches.some((match) => isProviderManagedId(match.id)),
      nextUpcomingProviderMatchStartsAt: nextUpcomingProviderMatch?.startsAt ?? null
    };
  }

  async createLeagueRecord(userId: string, input: CreateLeagueInput): Promise<League> {
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
    return structuredClone(league);
  }

  async joinLeagueByInvite(userId: string, input: JoinLeagueInput): Promise<League> {
    const league = this.store.leagues.find((entry) => entry.inviteCode === input.inviteCode);
    if (!league) {
      throw new Error("Invite code is invalid.");
    }

    if (!league.memberIds.includes(userId)) {
      league.memberIds.push(userId);
    }

    return structuredClone(league);
  }

  async submitRosterRecord(
    userId: string,
    contestId: string,
    input: SubmitRosterInput | BuildRosterInput
  ): Promise<Roster> {
    const contest = this.store.contests.find((entry) => entry.id === contestId);
    if (!contest) {
      throw new Error("Contest not found.");
    }

    const match = this.store.matches.find((entry) => entry.id === contest.matchId);
    if (!match) {
      throw new Error("Match not found.");
    }

    const matchPlayers = this.store.players.filter(
      (player) => player.teamId === match.homeTeamId || player.teamId === match.awayTeamId
    );
    const validation = validateRoster(contest, match, matchPlayers, input, new Date());
    if (!validation.valid) {
      throw new Error(validation.errors.join(" "));
    }

    const profile = this.store.profiles.find((entry) => entry.userId === userId);
    if (!profile) {
      throw new Error("Unknown profile.");
    }

    const existing = this.store.rosters.find(
      (entry) => entry.contestId === contestId && entry.userId === userId
    );
    const previousSpend = existing?.totalCredits ?? 0;
    const nextSpend = validation.totalCredits;
    const creditDelta = Math.round((nextSpend - previousSpend) * 10) / 10;
    if (creditDelta > profile.credits) {
      throw new Error(
        `Not enough credits. You need ${(creditDelta - profile.credits).toFixed(1)} more credits to save this roster.`
      );
    }

    profile.credits = Math.round((profile.credits - creditDelta) * 10) / 10;

    const roster: Roster = {
      id: existing?.id ?? crypto.randomUUID(),
      contestId,
      userId,
      players: input.playerIds.map((playerId) => ({ playerId })),
      captainPlayerId: input.captainPlayerId,
      viceCaptainPlayerId: input.viceCaptainPlayerId,
      impactPlayerId: "impactPlayerId" in input ? input.impactPlayerId ?? undefined : undefined,
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

    this.rebuildContestLeaderboard(contest.id);
    return structuredClone(roster);
  }

  async answerPredictionRecord(
    userId: string,
    questionId: string,
    input: PredictionAnswerInput
  ): Promise<PredictionAnswer> {
    const question = this.store.questions.find((entry) => entry.id === questionId);
    if (!question) {
      throw new Error("Prediction question not found.");
    }
    if (!canSubmitPrediction(question)) {
      throw new Error("Prediction is locked.");
    }
    if (!question.options.some((option) => option.id === input.optionId)) {
      throw new Error("Prediction option not found.");
    }

    const existing = this.store.answers.find(
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
      this.store.answers.push(answer);
    }

    return structuredClone(answer);
  }

  async settlePredictionRecord(
    questionId: string,
    correctOptionId: string
  ): Promise<{ settledCount: number; correctOptionId: string }> {
    const question = this.store.questions.find((entry) => entry.id === questionId);
    if (!question) {
      throw new Error("Prediction question not found.");
    }
    if (question.state === "settled") {
      throw new Error("Prediction already settled.");
    }
    if (!question.options.some((option) => option.id === correctOptionId)) {
      throw new Error("Prediction option not found.");
    }

    question.state = "settled";
    const settledAt = new Date().toISOString();
    const answers = this.store.answers.filter((entry) => entry.questionId === questionId);

    for (const answer of answers) {
      const profile = this.store.profiles.find((entry) => entry.userId === answer.userId);
      const inventory = this.store.inventories.find((entry) => entry.userId === answer.userId);
      if (!profile || !inventory) {
        continue;
      }

      const settled = settlePredictionAnswer(
        question,
        answer,
        correctOptionId,
        profile.streak,
        settledAt
      );
      this.store.results.push(settled.result);
      this.store.xpTransactions.push(settled.transaction);
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
        const item = this.store.cosmetics.find(
          (cosmetic) => cosmetic.id === settled.result.awardedCosmeticId
        );
        if (item) {
          const unlocked = unlockCosmetic(
            inventory,
            answer.userId,
            item,
            "prediction",
            settledAt
          );
          Object.assign(inventory, unlocked.inventory);
          if (unlocked.unlock) {
            this.store.cosmeticUnlocks.push(unlocked.unlock);
          }
        }
      }
    }

    return {
      settledCount: answers.length,
      correctOptionId
    };
  }

  async equipCosmeticRecord(userId: string, cosmeticId: string): Promise<{ cosmeticId: string }> {
    const inventory = this.store.inventories.find((entry) => entry.userId === userId);
    const profile = this.store.profiles.find((entry) => entry.userId === userId);
    const item = this.store.cosmetics.find((entry) => entry.id === cosmeticId);
    if (!inventory) {
      throw new Error("Inventory not found.");
    }
    if (!profile) {
      throw new Error("Unknown profile.");
    }
    if (!item) {
      throw new Error("Cosmetic not found.");
    }

    const updated = equipCosmetic(inventory, profile, item);
    Object.assign(inventory, updated.inventory);
    Object.assign(profile, updated.profile);
    return { cosmeticId };
  }

  async applyCorrectionRecord(
    matchId: string,
    playerId: string,
    label: string,
    points: number
  ): Promise<{ status: string }> {
    this.store.scoreEvents.push({
      id: crypto.randomUUID(),
      matchId,
      playerId,
      label,
      points,
      createdAt: new Date().toISOString()
    });

    this.store.contests
      .filter((contest) => contest.matchId === matchId)
      .forEach((contest) => this.rebuildContestLeaderboard(contest.id));

    return { status: "corrected" };
  }

  async rebuildAllLeaderboards(): Promise<void> {
    this.store.leaderboard = this.store.contests.flatMap((contest) =>
      buildContestLeaderboard(this.store, contest)
    );
  }

  async applyProviderSnapshot(snapshot: {
    contests: AppStore["contests"];
    matches: AppStore["matches"];
    players: AppStore["players"];
    questions: AppStore["questions"];
    scoreEvents: AppStore["scoreEvents"];
    syncedAt: string;
    teams: AppStore["teams"];
  }): Promise<void> {
    this.store.teams = [
      ...this.store.teams.filter((team) => !isProviderManagedId(team.id)),
      ...snapshot.teams
    ];
    this.store.players = [
      ...this.store.players.filter((player) => !isProviderManagedId(player.id)),
      ...snapshot.players
    ];
    this.store.matches = [
      ...this.store.matches.filter((match) => !isProviderManagedId(match.id)),
      ...snapshot.matches
    ];
    this.store.contests = [
      ...this.store.contests.filter((contest) => !isProviderManagedId(contest.id)),
      ...snapshot.contests
    ];
    this.store.questions = [
      ...this.store.questions.filter((question) => !isProviderManagedId(question.id)),
      ...snapshot.questions
    ];
    this.store.scoreEvents = [
      ...this.store.scoreEvents.filter((event) => !isProviderManagedId(event.id)),
      ...snapshot.scoreEvents
    ];
    this.store.provider = {
      status: "ready",
      syncedAt: snapshot.syncedAt,
      lastAttemptedAt: snapshot.syncedAt
    };
    await this.rebuildAllLeaderboards();
  }

  async updateProviderState(patch: Partial<AppStore["provider"]>): Promise<void> {
    this.store.provider = {
      ...this.store.provider,
      ...patch
    };
  }

  private rebuildContestLeaderboard(contestId: string) {
    const contest = this.store.contests.find((entry) => entry.id === contestId);
    if (!contest) {
      return;
    }

    const withoutContest = this.store.leaderboard.filter((entry) => entry.contestId !== contestId);
    this.store.leaderboard = [...withoutContest, ...buildContestLeaderboard(this.store, contest)];
  }
}

describe("auth service", () => {
  it("registers a new user, creates a session token, and authenticates it", async () => {
    const repository = new TestRuntimeRepository(createDemoSeedStore());
    const authService = new AuthService(repository);

    const session = await authService.register({
      name: "New Captain",
      email: "newcaptain@example.com",
      password: "password123"
    });
    const nextStore = repository.getStore();
    const profile = nextStore.profiles.find((entry) => entry.userId === session.userId);

    expect(session.token).toBeTruthy();
    expect(session.onboardingCompleted).toBe(false);
    expect(nextStore.sessions).toHaveLength(1);
    expect(profile?.credits).toBe(100);
    expect(await authService.authenticate(session.token)).toBe(session.userId);
  });

  it("rejects duplicate registration emails and wrong passwords", async () => {
    const repository = new TestRuntimeRepository(createDemoSeedStore());
    const authService = new AuthService(repository);

    await expect(
      authService.register({
        name: "Another Aisha",
        email: "captain@cricketclub.test",
        password: "password123"
      })
    ).rejects.toThrow("already exists");

    await expect(
      authService.login({
        email: "captain@cricketclub.test",
        password: "wrong-password"
      })
    ).rejects.toThrow("Invalid email or password.");
  });

  it("logs in with seeded credentials, completes onboarding, and revokes the session", async () => {
    const repository = new TestRuntimeRepository(createDemoSeedStore());
    const authService = new AuthService(repository);

    const session = await authService.login({
      email: "captain@cricketclub.test",
      password: "password123"
    });

    expect(session.userId).toBe("user-1");
    expect(session.onboardingCompleted).toBe(true);

    const profile = await authService.completeOnboarding("user-1", {
      username: "CaptainAisha",
      favoriteTeamId: "team-mi"
    });

    expect(profile.username).toBe("CaptainAisha");
    expect(profile.favoriteTeamId).toBe("team-mi");
    expect(profile.onboardingCompleted).toBe(true);

    await authService.revoke(session.token);
    await expect(authService.authenticate(session.token)).rejects.toThrow("Session expired.");
  });

  it("rejects onboarding when the username is already taken", async () => {
    const repository = new TestRuntimeRepository(createDemoSeedStore());
    const authService = new AuthService(repository);

    await expect(
      authService.completeOnboarding("user-1", {
        username: "LateCutRehan",
        favoriteTeamId: "team-mi"
      })
    ).rejects.toThrow("Username is already taken.");
  });

  it("enforces admin authorization through the user record", async () => {
    const repository = new TestRuntimeRepository(createDemoSeedStore());
    const authService = new AuthService(repository);

    await expect(authService.assertAdmin("user-1")).resolves.toBeUndefined();
    await expect(authService.assertAdmin("user-2")).rejects.toThrow("Admin authorization failed.");
  });

  it("grants admin access only to the first registered account when none exist", async () => {
    const repository = new TestRuntimeRepository(createBootstrapStore());
    const authService = new AuthService(repository);

    const first = await authService.register({
      name: "Owner",
      email: "owner@example.com",
      password: "password123"
    });
    const second = await authService.register({
      name: "Member",
      email: "member@example.com",
      password: "password123"
    });

    await expect(authService.assertAdmin(first.userId)).resolves.toBeUndefined();
    await expect(authService.assertAdmin(second.userId)).rejects.toThrow("Admin authorization failed.");
  });
});

describe("game service prediction settlement", () => {
  it("awards xp, badges, cosmetics, and updates streaks", async () => {
    const repository = new TestRuntimeRepository(createDemoSeedStore());
    const gameService = new GameService(repository);
    await gameService.initialize();

    await gameService.answerPrediction("user-1", "question-1", { optionId: "question-1-a" });
    await gameService.answerPrediction("user-1", "question-2", { optionId: "question-2-b" });

    const winnerResult = await gameService.settlePrediction("question-1", "question-1-a");
    const propResult = await gameService.settlePrediction("question-2", "question-2-b");
    const nextStore = repository.getStore();

    const profile = nextStore.profiles.find((entry) => entry.userId === "user-1");
    const inventory = nextStore.inventories.find((entry) => entry.userId === "user-1");

    expect(winnerResult.settledCount).toBe(1);
    expect(propResult.settledCount).toBe(1);
    expect(profile?.xp).toBe(250);
    expect(profile?.level).toBe(3);
    expect(profile?.streak).toBe(4);
    expect(inventory?.badgeIds).toContain("badge-night-watch");
    expect(inventory?.cosmeticIds).toContain("cos-frame-copper");
    expect(nextStore.results).toHaveLength(2);
    expect(nextStore.xpTransactions).toHaveLength(3);
  });
});

describe("game service roster credits", () => {
  it("gives new users enough credits for their first team and charges roster costs by delta", async () => {
    const repository = new TestRuntimeRepository(createDemoSeedStore());
    const authService = new AuthService(repository);
    const gameService = new GameService(repository);
    await gameService.initialize();

    const session = await authService.register({
      name: "Squad Builder",
      email: "squadbuilder@example.com",
      password: "password123"
    });

    await authService.completeOnboarding(session.userId, {
      username: "SquadBuilder",
      favoriteTeamId: "team-mi"
    });

    const firstRoster = await gameService.submitRoster(session.userId, "contest-1", {
      playerIds: ["p1", "p2", "p3", "p4", "p5", "p8", "p9", "p10", "p11", "p12", "p13"],
      captainPlayerId: "p2",
      viceCaptainPlayerId: "p12"
    });

    let nextStore = repository.getStore();
    let profile = nextStore.profiles.find((entry) => entry.userId === session.userId);

    expect(firstRoster.totalCredits).toBe(95.5);
    expect(profile?.credits).toBe(4.5);

    const updatedRoster = await gameService.submitRoster(session.userId, "contest-1", {
      playerIds: ["p1", "p3", "p4", "p5", "p6", "p7", "p8", "p10", "p11", "p13", "p14"],
      captainPlayerId: "p4",
      viceCaptainPlayerId: "p11"
    });

    nextStore = repository.getStore();
    profile = nextStore.profiles.find((entry) => entry.userId === session.userId);

    expect(updatedRoster.totalCredits).toBe(92);
    expect(profile?.credits).toBe(8);

    await expect(
      gameService.submitRoster(session.userId, "contest-2", {
        playerIds: ["p1", "p2", "p3", "p4", "p5", "p8", "p9", "p10", "p11", "p12", "p13"],
        captainPlayerId: "p2",
        viceCaptainPlayerId: "p12"
      })
    ).rejects.toThrow("Not enough credits.");
  });
});

describe("provider sync", () => {
  it("imports provider matches, squads, and score events into the public dashboard", async () => {
    const gateway: ProviderSyncGateway = {
      async getIPLMatches() {
        return [
          {
            id: "ipl-1",
            name: "Mumbai Indians vs Chennai Super Kings",
            short_name: "MI vs CSK",
            series_id: "ipl-2026",
            series_name: "IPL 2026",
            format: "t20",
            status: "upcoming",
            start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            venue: "Eden Arena",
            city: "Mumbai",
            home_team: { id: "mi", name: "Mumbai Indians", short_name: "MI" },
            away_team: { id: "csk", name: "Chennai Super Kings", short_name: "CSK" }
          }
        ];
      },
      async getMatchSquad() {
        return [
          {
            team_id: "mi",
            team_name: "Mumbai Indians",
            players: [
              {
                id: "p-mi-1",
                name: "Viraj Rao",
                team_id: "mi",
                team_name: "Mumbai Indians",
                role: "BAT",
                country: "India",
                selection_percent: 72
              },
              {
                id: "p-mi-2",
                name: "Amit Singh",
                team_id: "mi",
                team_name: "Mumbai Indians",
                role: "BOWL",
                country: "India",
                selection_percent: 45
              }
            ]
          },
          {
            team_id: "csk",
            team_name: "Chennai Super Kings",
            players: [
              {
                id: "p-csk-1",
                name: "Daniel Ross",
                team_id: "csk",
                team_name: "Chennai Super Kings",
                role: "AR",
                country: "Australia",
                selection_percent: 61
              },
              {
                id: "p-csk-2",
                name: "Rakesh Iyer",
                team_id: "csk",
                team_name: "Chennai Super Kings",
                role: "WK",
                country: "India",
                selection_percent: 54
              }
            ]
          }
        ];
      },
      async getScorecard() {
        return {
          match_id: "ipl-1",
          innings: [
            {
              batting_team: "Mumbai Indians",
              bowling_team: "Chennai Super Kings",
              total_runs: 180,
              total_wickets: 6,
              total_overs: 20,
              extras: 8,
              batting: [
                {
                  player_id: "p-mi-1",
                  player_name: "Viraj Rao",
                  runs: 54,
                  balls: 35,
                  fours: 5,
                  sixes: 2,
                  strike_rate: 154.2,
                  out: true
                }
              ],
              bowling: [
                {
                  player_id: "p-csk-1",
                  player_name: "Daniel Ross",
                  overs: 4,
                  maidens: 0,
                  runs: 28,
                  wickets: 2,
                  economy: 7,
                  dots: 9
                }
              ],
              fall_of_wickets: []
            }
          ]
        };
      }
    };

    const repository = new TestRuntimeRepository(createDemoSeedStore());
    const gameService = new GameService(repository, gateway);

    const syncResult = await gameService.syncProvider();
    const dashboard = await gameService.getDashboard("user-1");

    expect(syncResult.matches).toBe(1);
    expect(syncResult.players).toBe(4);
    expect(dashboard.contests.some((contest) => contest.id.startsWith("provider:contest:"))).toBe(true);
    expect(dashboard.matches.some((match) => match.id.startsWith("provider:match:"))).toBe(true);
    expect(dashboard.questions.some((question) => question.id.startsWith("provider:question:"))).toBe(true);
    expect(dashboard.players.some((player) => player.id.startsWith("provider:player:"))).toBe(true);
    expect(dashboard.teams.some((team) => team.name === "Mumbai Indians" && team.shortName === "MI")).toBe(true);
    expect(dashboard.teams.some((team) => team.name === "Chennai Super Kings" && team.shortName === "CSK")).toBe(true);
  });

  it("preserves existing provider data when the upstream snapshot is empty", async () => {
    const gateway: ProviderSyncGateway = {
      async getIPLMatches() {
        return [];
      },
      async getMatchSquad() {
        return [];
      },
      async getScorecard() {
        throw new Error("not used");
      }
    };

    const repository = new TestRuntimeRepository(createDemoSeedStore());
    repository.applyProviderSnapshot({
      contests: [
        {
          id: "provider:contest:stale",
          name: "Provider Contest",
          kind: "public",
          matchId: "provider:match:stale",
          salaryCap: 100,
          rosterRules: defaultRosterRules,
          iplRules: {
            maxPlayersPerTeam: 7,
            allowImpactPlayer: true,
            uncappedBonusPoints: 10
          },
          lockTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          rewards: []
        }
      ],
      matches: [
        {
          id: "provider:match:stale",
          homeTeamId: "provider:team:mi",
          awayTeamId: "provider:team:csk",
          startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          venue: "Stadium",
          state: "scheduled"
        }
      ],
      players: [],
      questions: [],
      scoreEvents: [],
      syncedAt: new Date().toISOString(),
      teams: [
        { id: "provider:team:mi", name: "Mumbai Indians", shortName: "MI", city: "Mumbai" },
        { id: "provider:team:csk", name: "Chennai Super Kings", shortName: "CSK", city: "Chennai" }
      ]
    });

    const gameService = new GameService(repository, gateway);

    await expect(gameService.syncProvider()).rejects.toThrow("returned no matches");
    const dashboard = await gameService.getDashboard("user-1");

    expect(dashboard.matches.some((match) => match.id === "provider:match:stale")).toBe(true);
  });
});
