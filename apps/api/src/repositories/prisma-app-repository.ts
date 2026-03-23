import {
  createInviteCode,
  createLeagueBanner,
  equipCosmetic,
  levelFromXp,
  normalizeIplTeam,
  unlockCosmetic,
  validateRoster
} from "@fantasy-cricket/domain";
import { calculateRosterPoints, canSubmitPrediction, settlePredictionAnswer } from "@fantasy-cricket/scoring";
import type {
  BuildRosterInput,
  Badge,
  BootstrapPayload,
  Contest,
  ContestPagePayload,
  CosmeticItem,
  CosmeticUnlock,
  DashboardPayload,
  FantasyScoreEvent,
  Friendship,
  HomePagePayload,
  InventoryPagePayload,
  Invite,
  LeaderboardEntry,
  League,
  Match,
  Player,
  PlayerMatchStatLine,
  PredictionAnswer,
  PredictionFeedPayload,
  PredictionPagePayload,
  PredictionQuestion,
  PredictionResult,
  Profile,
  Roster,
  Team,
  TeamWithPlayers,
  User,
  UserInventory,
  XPTransaction
} from "@fantasy-cricket/types";
import type {
  CreateLeagueInput,
  JoinLeagueInput,
  PredictionAnswerInput,
  SubmitRosterInput
} from "@fantasy-cricket/validators";

import type { AppStore } from "../data/store.js";
import { loadEnv } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type {
  ProviderStateCreateInput,
  ProviderStateModel,
  ProviderStateUpdateInput
} from "../generated/prisma/models/ProviderState";
import type {
  AuthRuntimeRepository,
  GameRuntimeRepository,
  ProviderStateSnapshot
} from "./runtime-repository.js";
import type { ProviderSyncSnapshot } from "../services/provider-sync-service.js";

const SNAPSHOT_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 180_000
} as const;
const DASHBOARD_PUBLIC_CONTEST_LIMIT = 8;
const DASHBOARD_PRIVATE_CONTEST_LIMIT = 8;
const DASHBOARD_LEAGUE_LIMIT = 20;
const DASHBOARD_PREDICTION_LIMIT = 12;
const DASHBOARD_LEADERBOARD_LIMIT = 25;
const DEFAULT_LEAGUE_SQUAD_SIZE = 13;
const env = loadEnv();

function asJson<T>(value: Prisma.JsonValue | null): T {
  return (value ?? null) as T;
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) {
    return null;
  }

  return new Date(value);
}

function toDateString(value: Date | null): string | undefined {
  return value?.toISOString();
}

function providerBudgetDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

function mapUsers(rows: Array<{ id: string; email: string; name: string; isAdmin: boolean; createdAt: Date }>): User[] {
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    isAdmin: row.isAdmin,
    createdAt: row.createdAt.toISOString()
  }));
}

function mapProfiles(rows: Array<{ userId: string; username: string; bio: string | null; favoriteTeamId: string | null; xp: number; level: number; streak: number; onboardingCompleted: boolean; equippedCosmetics: Prisma.JsonValue }>): Profile[] {
  return rows.map((row) => ({
    userId: row.userId,
    username: row.username,
    bio: row.bio ?? undefined,
    favoriteTeamId: row.favoriteTeamId ?? undefined,
    xp: row.xp,
    level: row.level,
    streak: row.streak,
    onboardingCompleted: row.onboardingCompleted,
    equippedCosmetics: asJson<Profile["equippedCosmetics"]>(row.equippedCosmetics)
  }));
}

function mapFriendships(rows: Array<{ id: string; requesterId: string; addresseeId: string; status: string; createdAt: Date }>): Friendship[] {
  return rows.map((row) => ({
    id: row.id,
    requesterId: row.requesterId,
    addresseeId: row.addresseeId,
    status: row.status as Friendship["status"],
    createdAt: row.createdAt.toISOString()
  }));
}

function mapInvites(rows: Array<{ id: string; leagueId: string; code: string; createdBy: string; createdAt: Date; expiresAt: Date | null }>): Invite[] {
  return rows.map((row) => ({
    id: row.id,
    leagueId: row.leagueId,
    code: row.code,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    expiresAt: toDateString(row.expiresAt)
  }));
}

function mapTeams(rows: Array<{ id: string; name: string; shortName: string; city: string }>): Team[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    city: row.city
  }));
}

function mapPlayers(rows: Array<{ id: string; name: string; teamId: string; role: string; rating: number; nationality: string; selectionPercent: number }>): Player[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    teamId: row.teamId,
    role: row.role as Player["role"],
    rating: row.rating,
    nationality: row.nationality as Player["nationality"],
    selectionPercent: row.selectionPercent
  }));
}

function preferCanonicalTeamsWithPlayers(
  rows: Array<{
    id: string;
    name: string;
    shortName: string;
    city: string;
    players: Array<{
      id: string;
      name: string;
      teamId: string;
      role: string;
      rating: number;
      nationality: string;
      selectionPercent: number;
    }>;
  }>
): TeamWithPlayers[] {
  const canonicalByShortName = new Map<string, TeamWithPlayers>();

  for (const row of rows) {
    const normalizedTeam = normalizeIplTeam(mapTeams([row])[0]);
    const players = mapPlayers(row.players);
    const nextTeam: TeamWithPlayers = {
      ...normalizedTeam,
      players
    };

    const current = canonicalByShortName.get(nextTeam.shortName);
    if (!current) {
      canonicalByShortName.set(nextTeam.shortName, nextTeam);
      continue;
    }

    const shouldReplace =
      nextTeam.players.length > current.players.length ||
      (nextTeam.players.length === current.players.length &&
        current.id.startsWith("team-") &&
        nextTeam.id.startsWith("provider:"));

    if (shouldReplace) {
      canonicalByShortName.set(nextTeam.shortName, nextTeam);
    }
  }

  return [...canonicalByShortName.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

function mapMatches(rows: Array<{ id: string; homeTeamId: string; awayTeamId: string; startsAt: Date; venue: string; state: string }>): Match[] {
  return rows.map((row) => ({
    id: row.id,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    startsAt: row.startsAt.toISOString(),
    venue: row.venue,
    state: row.state as Match["state"]
  }));
}

function mapContests(rows: Array<{ id: string; name: string; kind: string; matchId: string; leagueId: string | null; rosterRules: Prisma.JsonValue; lockTime: Date; rewards: Prisma.JsonValue }>): Contest[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as Contest["kind"],
    matchId: row.matchId,
    leagueId: row.leagueId ?? undefined,
    rosterRules: asJson<Contest["rosterRules"]>(row.rosterRules),
    lockTime: row.lockTime.toISOString(),
    rewards: asJson<Contest["rewards"]>(row.rewards)
  }));
}

function mapLeagues(rows: Array<{
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  createdBy: string;
  inviteCode: string;
  bannerStyle: string;
  maxMembers: number;
  squadSize: number;
  members: Array<{ userId: string }>;
  contests: Array<{ id: string }>;
  auctionRooms?: Array<{ id: string }>;
}>): League[] {
  return rows.map((row) => toLeagueDto(row));
}

function mapRosters(rows: Array<{ id: string; contestId: string; userId: string; players: Prisma.JsonValue; captainPlayerId: string; viceCaptainPlayerId: string; submittedAt: Date; locked: boolean }>): Roster[] {
  return rows.map((row) => toRosterDto(row));
}

function mapScoreEvents(rows: Array<{ id: string; matchId: string; playerId: string; label: string; points: number; createdAt: Date }>): FantasyScoreEvent[] {
  return rows.map((row) => ({
    id: row.id,
    matchId: row.matchId,
    playerId: row.playerId,
    label: row.label,
    points: row.points,
    createdAt: row.createdAt.toISOString()
  }));
}

function mapPlayerMatchStatLines(rows: Array<{
  id: string;
  matchId: string;
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  maidens: number;
  dotBalls: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  runsConceded: number;
  ballsBowled: number;
  battingStrikeRate: number | null;
  bowlingEconomy: number | null;
  didPlay: boolean;
  didBat: boolean;
  didBowl: boolean;
  didField: boolean;
  sourceUpdatedAt: Date;
}>): PlayerMatchStatLine[] {
  return rows.map((row) => ({
    id: row.id,
    matchId: row.matchId,
    playerId: row.playerId,
    runs: row.runs,
    balls: row.balls,
    fours: row.fours,
    sixes: row.sixes,
    wickets: row.wickets,
    maidens: row.maidens,
    dotBalls: row.dotBalls,
    catches: row.catches,
    stumpings: row.stumpings,
    runOuts: row.runOuts,
    runsConceded: row.runsConceded,
    ballsBowled: row.ballsBowled,
    battingStrikeRate: row.battingStrikeRate ?? undefined,
    bowlingEconomy: row.bowlingEconomy ?? undefined,
    didPlay: row.didPlay,
    didBat: row.didBat,
    didBowl: row.didBowl,
    didField: row.didField,
    sourceUpdatedAt: row.sourceUpdatedAt.toISOString()
  }));
}

function mapLeaderboard(rows: Array<{ id: string; contestId: string; userId: string; points: number; rank: number; previousRank: number; trend: string; projectedPoints: number | null }>): LeaderboardEntry[] {
  return rows.map((row) => ({
    id: row.id,
    contestId: row.contestId,
    userId: row.userId,
    points: row.points,
    rank: row.rank,
    previousRank: row.previousRank,
    trend: row.trend as LeaderboardEntry["trend"],
    projectedPoints: row.projectedPoints ?? undefined
  }));
}

function withLeaderboardDisplayNames(
  entries: LeaderboardEntry[],
  profiles: Profile[],
  users: User[]
): LeaderboardEntry[] {
  const displayNameByUserId = new Map<string, string>();

  for (const profile of profiles) {
    displayNameByUserId.set(profile.userId, profile.username);
  }

  for (const user of users) {
    if (!displayNameByUserId.has(user.id)) {
      displayNameByUserId.set(user.id, user.name);
    }
  }

  return entries.map((entry) => ({
    ...entry,
    displayName: displayNameByUserId.get(entry.userId)
  }));
}

function mapQuestions(rows: Array<{ id: string; matchId: string; prompt: string; category: string; options: Prisma.JsonValue; locksAt: Date; resolvesAt: Date; state: string; xpReward: number; badgeRewardId: string | null; cosmeticRewardId: string | null }>): PredictionQuestion[] {
  return rows.map((row) => ({
    id: row.id,
    matchId: row.matchId,
    prompt: row.prompt,
    category: row.category as PredictionQuestion["category"],
    options: asJson<PredictionQuestion["options"]>(row.options),
    locksAt: row.locksAt.toISOString(),
    resolvesAt: row.resolvesAt.toISOString(),
    state: row.state as PredictionQuestion["state"],
    xpReward: row.xpReward,
    badgeRewardId: row.badgeRewardId ?? undefined,
    cosmeticRewardId: row.cosmeticRewardId ?? undefined
  }));
}

function mapAnswers(rows: Array<{ id: string; questionId: string; userId: string; optionId: string; submittedAt: Date }>): PredictionAnswer[] {
  return rows.map((row) => ({
    id: row.id,
    questionId: row.questionId,
    userId: row.userId,
    optionId: row.optionId,
    submittedAt: row.submittedAt.toISOString()
  }));
}

function mapResults(rows: Array<{ id: string; questionId: string; userId: string; correctOptionId: string; awardedXp: number; awardedBadgeId: string | null; awardedCosmeticId: string | null; streak: number; settledAt: Date }>): PredictionResult[] {
  return rows.map((row) => ({
    id: row.id,
    questionId: row.questionId,
    userId: row.userId,
    correctOptionId: row.correctOptionId,
    awardedXp: row.awardedXp,
    awardedBadgeId: row.awardedBadgeId ?? undefined,
    awardedCosmeticId: row.awardedCosmeticId ?? undefined,
    streak: row.streak,
    settledAt: row.settledAt.toISOString()
  }));
}

function mapCosmetics(rows: Array<{ id: string; name: string; description: string; category: string; rarity: string; themeToken: string; gameplayAffecting: boolean; transferable: boolean; redeemable: boolean; resaleValue: number }>): CosmeticItem[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category as CosmeticItem["category"],
    rarity: row.rarity as CosmeticItem["rarity"],
    themeToken: row.themeToken,
    gameplayAffecting: row.gameplayAffecting as false,
    transferable: row.transferable as false,
    redeemable: row.redeemable as false,
    resaleValue: row.resaleValue
  }));
}

function mapUnlocks(rows: Array<{ id: string; userId: string; cosmeticId: string; source: string; unlockedAt: Date }>): CosmeticUnlock[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    cosmeticId: row.cosmeticId,
    source: row.source as CosmeticUnlock["source"],
    unlockedAt: row.unlockedAt.toISOString()
  }));
}

function mapInventories(rows: Array<{ userId: string; cosmeticIds: string[]; badgeIds: string[]; equipped: Prisma.JsonValue }>): UserInventory[] {
  return rows.map((row) => ({
    userId: row.userId,
    cosmeticIds: row.cosmeticIds,
    badgeIds: row.badgeIds,
    equipped: asJson<UserInventory["equipped"]>(row.equipped)
  }));
}

function mapBadges(rows: Array<{ id: string; label: string; description: string; category: string; seasonId: string | null }>): Badge[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    category: row.category as Badge["category"],
    seasonId: row.seasonId ?? undefined
  }));
}

function mapXpTransactions(rows: Array<{ id: string; userId: string; source: string; amount: number; description: string; createdAt: Date }>): XPTransaction[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    source: row.source as XPTransaction["source"],
    amount: row.amount,
    description: row.description,
    createdAt: row.createdAt.toISOString()
  }));
}

function friendshipPairKey(requesterId: string, addresseeId: string) {
  return [requesterId, addresseeId].sort().join(":");
}

function preferredPublicContests(contests: Contest[]) {
  const providerManagedPublic = contests.filter(
    (contest) => contest.kind === "public" && contest.id.startsWith("provider:")
  );
  if (providerManagedPublic.length > 0) {
    return providerManagedPublic;
  }

  return contests.filter(
    (contest) => contest.kind === "public" && !contest.id.startsWith("provider:")
  );
}

function preferredQuestions(questions: PredictionQuestion[]) {
  const providerQuestions = questions.filter((question) => question.id.startsWith("provider:"));
  return providerQuestions.length > 0
    ? providerQuestions
    : questions.filter((question) => !question.id.startsWith("provider:"));
}

function normalizeQuestionsForDisplay(
  questions: PredictionQuestion[],
  matches: Match[],
  teams: Team[]
): PredictionQuestion[] {
  const normalizedTeams = teams.map((team) => normalizeIplTeam(team));
  const teamMap = new Map(normalizedTeams.map((team) => [team.id, team]));
  const matchMap = new Map(matches.map((match) => [match.id, match]));

  return questions.map((question) => {
    const match = matchMap.get(question.matchId);
    const homeTeam = match ? teamMap.get(match.homeTeamId) : undefined;
    const awayTeam = match ? teamMap.get(match.awayTeamId) : undefined;

    return {
      ...question,
      prompt:
        question.category === "winner" && homeTeam && awayTeam
          ? `Who wins ${homeTeam.name} vs ${awayTeam.name}?`
          : question.prompt,
      options: question.options.map((option) => {
        const linkedTeam = teamMap.get(option.value);
        return linkedTeam ? { ...option, label: linkedTeam.name } : option;
      })
    };
  });
}

function toLeagueDto(row: {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  createdBy: string;
  inviteCode: string;
  bannerStyle: string;
  maxMembers: number;
  squadSize: number;
  members: Array<{ userId: string }>;
  contests?: Array<{ id: string }>;
  auctionRooms?: Array<{ id: string }>;
}): League {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    visibility: row.visibility as League["visibility"],
    createdBy: row.createdBy,
    inviteCode: row.inviteCode,
    memberIds: row.members.map((member) => member.userId),
    contestIds: (row.contests ?? []).map((contest) => contest.id),
    bannerStyle: row.bannerStyle,
    mode: "season",
    maxMembers: row.maxMembers,
    squadSize: row.squadSize,
    auctionRoomId: row.auctionRooms?.[0]?.id
  };
}

function toRosterDto(row: {
  id: string;
  contestId: string;
  userId: string;
  players: Prisma.JsonValue;
  captainPlayerId: string;
  viceCaptainPlayerId: string;
  submittedAt: Date;
  locked: boolean;
}): Roster {
  return {
    id: row.id,
    contestId: row.contestId,
    userId: row.userId,
    players: asJson<Roster["players"]>(row.players),
    captainPlayerId: row.captainPlayerId,
    viceCaptainPlayerId: row.viceCaptainPlayerId,
    submittedAt: row.submittedAt.toISOString(),
    locked: row.locked
  };
}

function buildLeaderboardEntries(
  contest: Contest,
  rosters: Roster[],
  players: Player[],
  events: FantasyScoreEvent[],
  statLines: PlayerMatchStatLine[],
  previousEntries: LeaderboardEntry[]
): LeaderboardEntry[] {
  const previousRanks = new Map(previousEntries.map((entry) => [entry.userId, entry.rank]));

  return rosters
    .map((roster) => ({
      roster,
      score: calculateRosterPoints(roster, players, events, statLines).total
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ roster, score }, index) => {
      const currentRank = index + 1;
      const previousRank = previousRanks.get(roster.userId) ?? currentRank;

      return {
        id: `${contest.id}-${roster.userId}`,
        contestId: contest.id,
        userId: roster.userId,
        points: score,
        rank: currentRank,
        previousRank,
        trend:
          currentRank < previousRank ? "up" : currentRank > previousRank ? "down" : "steady"
      };
    });
}

type ProviderStateRow = Pick<
  ProviderStateModel,
  "id" | "status" | "syncedAt" | "lastAttemptedAt" | "requestDayKey" | "dailyRequestCount" | "blockedUntil"
>;

export class PrismaAppRepository implements AuthRuntimeRepository, GameRuntimeRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async listProfileUsernamesByBase(baseUsername: string): Promise<string[]> {
    const rows = await this.client.profile.findMany({
      where: {
        username: {
          startsWith: baseUsername,
          mode: "insensitive"
        }
      },
      select: {
        username: true
      }
    });

    return rows.map((row) => row.username);
  }

  async findUserLoginRecord(email: string): Promise<{
    user: User;
    profile: Profile;
    passwordHash: string;
  } | null> {
    const row = await this.client.user.findUnique({
      where: { email },
      include: {
        credential: true,
        profile: true
      }
    });

    if (!row?.credential || !row.profile) {
      return null;
    }

    return {
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        isAdmin: row.isAdmin,
        createdAt: row.createdAt.toISOString()
      },
      profile: {
        userId: row.profile.userId,
        username: row.profile.username,
        bio: row.profile.bio ?? undefined,
        favoriteTeamId: row.profile.favoriteTeamId ?? undefined,
        xp: row.profile.xp,
        level: row.profile.level,
        streak: row.profile.streak,
        onboardingCompleted: row.profile.onboardingCompleted,
        equippedCosmetics: asJson<Profile["equippedCosmetics"]>(row.profile.equippedCosmetics)
      },
      passwordHash: row.credential.passwordHash
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
    await this.client.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: payload.user.id,
          email: payload.user.email,
          name: payload.user.name,
          isAdmin: payload.user.isAdmin,
          createdAt: new Date(payload.user.createdAt)
        }
      });

      await tx.authCredential.create({
        data: {
          userId: payload.user.id,
          passwordHash: payload.passwordHash
        }
      });

      await tx.profile.create({
        data: {
          userId: payload.profile.userId,
          username: payload.profile.username,
          bio: payload.profile.bio ?? null,
          favoriteTeamId: payload.profile.favoriteTeamId ?? null,
          xp: payload.profile.xp,
          level: payload.profile.level,
          streak: payload.profile.streak,
          onboardingCompleted: payload.profile.onboardingCompleted,
          equippedCosmetics: inputJson(payload.profile.equippedCosmetics)
        }
      });

      await tx.userInventory.create({
        data: {
          userId: payload.user.id,
          cosmeticIds: [],
          badgeIds: [],
          equipped: inputJson({})
        }
      });

      await tx.session.create({
        data: {
          token: payload.sessionHash,
          userId: payload.user.id,
          createdAt: new Date(payload.sessionCreatedAt),
          expiresAt: new Date(payload.sessionExpiresAt)
        }
      });
    });
  }

  async createHashedSession(payload: {
    userId: string;
    sessionHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<void> {
    await this.client.session.create({
      data: {
        token: payload.sessionHash,
        userId: payload.userId,
        createdAt: new Date(payload.createdAt),
        expiresAt: new Date(payload.expiresAt)
      }
    });
  }

  async hasAnyAdminUser(): Promise<boolean> {
    const count = await this.client.user.count({
      where: { isAdmin: true }
    });

    return count > 0;
  }

  async completeOnboardingProfile(payload: {
    userId: string;
    username: string;
    favoriteTeamId: string;
  }): Promise<Profile> {
    const [team, duplicate] = await Promise.all([
      this.client.team.findUnique({
        where: { id: payload.favoriteTeamId },
        select: { id: true }
      }),
      this.client.profile.findFirst({
        where: {
          username: {
            equals: payload.username,
            mode: "insensitive"
          },
          NOT: {
            userId: payload.userId
          }
        },
        select: {
          userId: true
        }
      })
    ]);

    if (!team) {
      throw new Error("Favorite team not found.");
    }

    if (duplicate) {
      throw new Error("Username is already taken.");
    }

    const profile = await this.client.profile.update({
      where: { userId: payload.userId },
      data: {
        username: payload.username,
        favoriteTeamId: payload.favoriteTeamId,
        onboardingCompleted: true
      }
    });

    return {
      userId: profile.userId,
      username: profile.username,
      bio: profile.bio ?? undefined,
      favoriteTeamId: profile.favoriteTeamId ?? undefined,
      xp: profile.xp,
      level: profile.level,
      streak: profile.streak,
      onboardingCompleted: profile.onboardingCompleted,
      equippedCosmetics: asJson<Profile["equippedCosmetics"]>(profile.equippedCosmetics)
    };
  }

  async findActiveSessionUserId(sessionHash: string, now: string): Promise<string | null> {
    const session = await this.client.session.findUnique({
      where: { token: sessionHash },
      select: {
        userId: true,
        expiresAt: true
      }
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= new Date(now).getTime()) {
      await this.client.session.delete({
        where: { token: sessionHash }
      }).catch(() => undefined);
      return null;
    }

    return session.userId;
  }

  async deleteSessionByHash(sessionHash: string): Promise<void> {
    await this.client.session.deleteMany({
      where: { token: sessionHash }
    });
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true }
    });

    return user?.isAdmin ?? false;
  }

  async getBootstrapPayload(userId: string): Promise<BootstrapPayload> {
    const [userRow, teamRows] = await Promise.all([
      this.client.user.findUnique({
        where: { id: userId },
        include: {
          profile: true
        }
      }),
      this.client.team.findMany({
        orderBy: [{ name: "asc" }]
      })
    ]);

    if (!userRow) {
      throw new Error("Unknown user.");
    }

    if (!userRow.profile) {
      throw new Error("Unknown profile.");
    }

    return {
      user: mapUsers([userRow])[0],
      profile: mapProfiles([userRow.profile])[0],
      teams: mapTeams(teamRows).map((team) => normalizeIplTeam(team))
    };
  }

  async getHomePagePayload(userId: string): Promise<HomePagePayload> {
    const [userRow, contests, leagues, inventory] = await Promise.all([
      this.client.user.findUnique({
        where: { id: userId },
        include: {
          profile: true
        }
      }),
      this.getVisibleContestsForUser(userId),
      this.getVisibleLeaguesForUser(userId),
      this.getInventoryForUser(userId)
    ]);

    if (!userRow) {
      throw new Error("Unknown user.");
    }

    if (!userRow.profile) {
      throw new Error("Unknown profile.");
    }

    const matchIds = [...new Set(contests.map((contest) => contest.matchId))];
    const [providerHomeMatchRows, contestMatchRows, fallbackMatchRows, anyMatchRows] =
      await Promise.all([
        this.client.match.findMany({
          where: {
            id: {
              startsWith: "provider:"
            },
            state: {
              in: ["live", "scheduled"]
            }
          },
          orderBy: [{ startsAt: "asc" }],
          take: 8
        }),
        matchIds.length
          ? this.client.match.findMany({
              where: {
                id: {
                  in: matchIds
                }
              }
            })
          : Promise.resolve([]),
        this.client.match.findMany({
          where: {
            state: {
              in: ["live", "scheduled"]
            }
          },
          orderBy: [{ startsAt: "asc" }],
          take: 8
        }),
        this.client.match.findMany({
          orderBy: [{ startsAt: "asc" }],
          take: 8
        })
      ]);

    const matchRows =
      providerHomeMatchRows.length > 0
        ? providerHomeMatchRows
        : contestMatchRows.length > 0
          ? contestMatchRows
          : fallbackMatchRows.length > 0
            ? fallbackMatchRows
            : anyMatchRows;

    const matches = mapMatches(matchRows);
    const teamIds = [...new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]))];
    const teamRows = teamIds.length
      ? await this.client.team.findMany({
          where: {
            id: {
              in: teamIds
            }
          }
        })
      : [];

    return {
      user: mapUsers([userRow])[0],
      profile: mapProfiles([userRow.profile])[0],
      contests,
      matches,
      teams: mapTeams(teamRows).map((team) => normalizeIplTeam(team)),
      leagueCount: leagues.length,
      lockerItemCount: inventory.inventory.cosmeticIds.length
    };
  }

  async getTeamsWithPlayers(): Promise<TeamWithPlayers[]> {
    const rows = await this.client.team.findMany({
      include: {
        players: true
      },
      orderBy: [{ shortName: "asc" }]
    });

    return preferCanonicalTeamsWithPlayers(rows);
  }

  async getContestPagePayload(userId: string): Promise<ContestPagePayload> {
    const [userRow, contests] = await Promise.all([
      this.client.user.findUnique({
        where: { id: userId },
        include: {
          profile: true
        }
      }),
      this.getVisibleContestsForUser(userId)
    ]);

    if (!userRow) {
      throw new Error("Unknown user.");
    }

    if (!userRow.profile) {
      throw new Error("Unknown profile.");
    }

    const matchIds = [...new Set(contests.map((contest) => contest.matchId))];
    const matchRows = matchIds.length
      ? await this.client.match.findMany({
          where: {
            id: {
              in: matchIds
            }
          }
        })
      : [];
    const matches = mapMatches(matchRows);
    const teamIds = [...new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]))];
    const contestIds = contests.map((contest) => contest.id);

    const [teamRows, playerRows, rosterRows, leaderboardGroups] = await Promise.all([
      teamIds.length
        ? this.client.team.findMany({
            where: {
              id: {
                in: teamIds
              }
            }
          })
        : Promise.resolve([]),
      teamIds.length
        ? this.client.player.findMany({
            where: {
              teamId: {
                in: teamIds
              }
            }
          })
        : Promise.resolve([]),
      contestIds.length
        ? this.client.roster.findMany({
            where: {
              contestId: {
                in: contestIds
              },
              userId
            }
          })
        : Promise.resolve([]),
      contestIds.length
        ? Promise.all(
            contestIds.map((contestId) =>
              this.client.leaderboardEntry.findMany({
                where: { contestId },
                orderBy: [{ rank: "asc" }, { points: "desc" }],
                take: DASHBOARD_LEADERBOARD_LIMIT
              })
            )
          )
        : Promise.resolve([])
    ]);

    const leaderboardRows = leaderboardGroups.flat();
    const leaderboardUserIds = [...new Set(leaderboardRows.map((entry) => entry.userId))];
    const [leaderboardProfileRows, leaderboardUserRows] = await Promise.all([
      leaderboardUserIds.length
        ? this.client.profile.findMany({
            where: {
              userId: {
                in: leaderboardUserIds
              }
            }
          })
        : Promise.resolve([]),
      leaderboardUserIds.length
        ? this.client.user.findMany({
            where: {
              id: {
                in: leaderboardUserIds
              }
            }
          })
        : Promise.resolve([])
    ]);

    return {
      contests,
      matches,
      teams: mapTeams(teamRows).map((team) => normalizeIplTeam(team)),
      players: mapPlayers(playerRows),
      rosters: mapRosters(rosterRows),
      leaderboard: withLeaderboardDisplayNames(
        mapLeaderboard(leaderboardRows),
        mapProfiles(leaderboardProfileRows),
        mapUsers(leaderboardUserRows)
      )
    };
  }

  async getPredictionPagePayload(userId: string): Promise<PredictionPagePayload> {
    const [userRow, feed] = await Promise.all([
      this.client.user.findUnique({
        where: { id: userId },
        include: {
          profile: true
        }
      }),
      this.getPredictionFeedForUser(userId)
    ]);

    if (!userRow) {
      throw new Error("Unknown user.");
    }

    if (!userRow.profile) {
      throw new Error("Unknown profile.");
    }

    const matchIds = [...new Set(feed.questions.map((question) => question.matchId))];
    const matchRows = matchIds.length
      ? await this.client.match.findMany({
          where: {
            id: {
              in: matchIds
            }
          }
        })
      : [];
    const matches = mapMatches(matchRows);
    const teamIds = [...new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]))];
    const teamRows = teamIds.length
      ? await this.client.team.findMany({
          where: {
            id: {
              in: teamIds
            }
          }
        })
      : [];

    return {
      profile: mapProfiles([userRow.profile])[0],
      teams: mapTeams(teamRows).map((team) => normalizeIplTeam(team)),
      questions: feed.questions,
      answers: feed.answers,
      results: feed.results
    };
  }

  async getInventoryPagePayload(userId: string): Promise<InventoryPagePayload> {
    const [userRow, inventoryPayload] = await Promise.all([
      this.client.user.findUnique({
        where: { id: userId },
        include: {
          profile: true
        }
      }),
      this.getInventoryForUser(userId)
    ]);

    if (!userRow) {
      throw new Error("Unknown user.");
    }

    if (!userRow.profile) {
      throw new Error("Unknown profile.");
    }

    const badgeRows = inventoryPayload.inventory.badgeIds.length
      ? await this.client.badge.findMany({
          where: {
            id: {
              in: inventoryPayload.inventory.badgeIds
            }
          }
        })
      : [];

    return {
      profile: mapProfiles([userRow.profile])[0],
      inventory: inventoryPayload.inventory,
      cosmetics: inventoryPayload.cosmetics,
      badges: mapBadges(badgeRows)
    };
  }

  async getDashboardPayload(userId: string): Promise<DashboardPayload> {
    const [userRow, inventoryRow, cosmeticsRows, badgesRows, contests, leagues, predictions] =
      await Promise.all([
        this.client.user.findUnique({
          where: { id: userId },
          include: {
            profile: true
          }
        }),
        this.client.userInventory.findUnique({
          where: { userId }
        }),
        this.client.cosmeticItem.findMany(),
        this.client.badge.findMany(),
        this.getVisibleContestsForUser(userId),
        this.getVisibleLeaguesForUser(userId),
        this.getPredictionFeedForUser(userId)
      ]);

    if (!userRow) {
      throw new Error("Unknown user.");
    }

    if (!userRow.profile) {
      throw new Error("Unknown profile.");
    }

    if (!inventoryRow) {
      throw new Error("Inventory not found.");
    }

    const matchIds = [
      ...new Set([
        ...contests.map((contest) => contest.matchId),
        ...predictions.questions.map((question) => question.matchId)
      ])
    ];
    const matchRows = matchIds.length
      ? await this.client.match.findMany({
          where: {
            id: {
              in: matchIds
            }
          }
        })
      : [];
    const matches = mapMatches(matchRows);
    const teamIds = [
      ...new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]))
    ];
    const teamRows = teamIds.length
      ? await this.client.team.findMany({
          where: {
            id: {
              in: teamIds
            }
          }
        })
      : [];
    const teams = mapTeams(teamRows).map((team) => normalizeIplTeam(team));
    const contestIds = contests.map((contest) => contest.id);

    const [playerRows, rosterRows, leaderboardGroups] = await Promise.all([
      teamIds.length
        ? this.client.player.findMany({
            where: {
              teamId: {
                in: teamIds
              }
            }
          })
        : Promise.resolve([]),
      contestIds.length
        ? this.client.roster.findMany({
            where: {
              contestId: {
                in: contestIds
              },
              userId
            }
          })
        : Promise.resolve([]),
      contestIds.length
        ? Promise.all(
            contestIds.map((contestId) =>
              this.client.leaderboardEntry.findMany({
                where: { contestId },
                orderBy: [{ rank: "asc" }, { points: "desc" }],
                take: DASHBOARD_LEADERBOARD_LIMIT
              })
            )
          )
        : Promise.resolve([])
    ]);
    const leaderboardRows = leaderboardGroups.flat();
    const leaderboardUserIds = [...new Set(leaderboardRows.map((entry) => entry.userId))];
    const [leaderboardProfileRows, leaderboardUserRows] = await Promise.all([
      leaderboardUserIds.length
        ? this.client.profile.findMany({
            where: {
              userId: {
                in: leaderboardUserIds
              }
            }
          })
        : Promise.resolve([]),
      leaderboardUserIds.length
        ? this.client.user.findMany({
            where: {
              id: {
                in: leaderboardUserIds
              }
            }
          })
        : Promise.resolve([])
    ]);

    return {
      user: mapUsers([userRow])[0],
      profile: mapProfiles([userRow.profile])[0],
      contests,
      leagues,
      matches,
      teams,
      players: mapPlayers(playerRows),
      rosters: mapRosters(rosterRows),
      leaderboard: withLeaderboardDisplayNames(
        mapLeaderboard(leaderboardRows),
        mapProfiles(leaderboardProfileRows),
        mapUsers(leaderboardUserRows)
      ),
      questions: predictions.questions,
      answers: predictions.answers,
      inventory: mapInventories([inventoryRow])[0],
      cosmetics: mapCosmetics(cosmeticsRows),
      badges: mapBadges(badgesRows)
    };
  }

  async getVisibleContestsForUser(userId: string): Promise<Contest[]> {
    const [providerMatchCount, publicContestRows, privateContestRows] = await Promise.all([
      this.client.match.count({
        where: {
          id: {
            startsWith: "provider:"
          }
        }
      }),
      this.client.contest.findMany({
        where: { kind: "public" },
        orderBy: [{ lockTime: "asc" }],
        take: DASHBOARD_PUBLIC_CONTEST_LIMIT
      }),
      this.client.contest.findMany({
        where: {
          kind: "private",
          league: {
            OR: [{ visibility: "public" }, { members: { some: { userId } } }]
          }
        },
        orderBy: [{ lockTime: "asc" }],
        take: DASHBOARD_PRIVATE_CONTEST_LIMIT
      })
    ]);

    const publicContests = mapContests(publicContestRows);
    const providerPublicContests = publicContests.filter((contest) => contest.id.startsWith("provider:"));

    return [
      ...(providerMatchCount > 0 && providerPublicContests.length > 0
        ? providerPublicContests
        : preferredPublicContests(publicContests)),
      ...mapContests(privateContestRows)
    ];
  }

  async getVisibleLeaguesForUser(userId: string): Promise<League[]> {
    const rows = await this.client.league.findMany({
      where: {
        OR: [{ visibility: "public" }, { members: { some: { userId } } }]
      },
      include: {
        members: {
          select: { userId: true }
        },
        contests: {
          select: { id: true }
        },
        auctionRooms: {
          select: { id: true },
          orderBy: [{ createdAt: "desc" }],
          take: 1
        }
      },
      orderBy: [{ name: "asc" }],
      take: DASHBOARD_LEAGUE_LIMIT
    });

    return mapLeagues(rows);
  }

  async getPredictionFeedForUser(userId: string): Promise<PredictionFeedPayload> {
    const questionRows = await this.client.predictionQuestion.findMany({
      orderBy: [{ locksAt: "asc" }]
    });
    const preferred = preferredQuestions(mapQuestions(questionRows)).slice(0, DASHBOARD_PREDICTION_LIMIT);
    const questionIds = preferred.map((question) => question.id);
    const matchIds = [...new Set(preferred.map((question) => question.matchId))];
    const matchRows = matchIds.length
      ? await this.client.match.findMany({
          where: {
            id: {
              in: matchIds
            }
          }
        })
      : [];
    const matches = mapMatches(matchRows);
    const teamIds = [
      ...new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]))
    ];
    const teamRows = teamIds.length
      ? await this.client.team.findMany({
          where: {
            id: {
              in: teamIds
            }
          }
        })
      : [];
    const [answerRows, resultRows] = await Promise.all([
      questionIds.length
        ? this.client.predictionAnswer.findMany({
            where: {
              userId,
              questionId: {
                in: questionIds
              }
            }
          })
        : Promise.resolve([]),
      questionIds.length
        ? this.client.predictionResult.findMany({
            where: {
              userId,
              questionId: {
                in: questionIds
              }
            }
          })
        : Promise.resolve([])
    ]);

    return {
      questions: normalizeQuestionsForDisplay(preferred, matches, mapTeams(teamRows)),
      answers: mapAnswers(answerRows),
      results: mapResults(resultRows)
    };
  }

  async getInventoryForUser(
    userId: string
  ): Promise<{ inventory: UserInventory; cosmetics: CosmeticItem[] }> {
    const inventoryRow = await this.client.userInventory.findUnique({
      where: { userId }
    });
    if (!inventoryRow) {
      throw new Error("Inventory not found.");
    }

    const inventory = mapInventories([inventoryRow])[0];
    const cosmetics = inventory.cosmeticIds.length
      ? mapCosmetics(
          await this.client.cosmeticItem.findMany({
            where: {
              id: {
                in: inventory.cosmeticIds
              }
            }
          })
        )
      : [];

    return { inventory, cosmetics };
  }

  async getContestLeaderboardEntries(contestId: string): Promise<LeaderboardEntry[]> {
    const rows = await this.client.leaderboardEntry.findMany({
        where: { contestId },
        orderBy: [{ rank: "asc" }, { points: "desc" }],
        take: DASHBOARD_LEADERBOARD_LIMIT
      });
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const [profileRows, userRows] = await Promise.all([
      userIds.length
        ? this.client.profile.findMany({
            where: {
              userId: {
                in: userIds
              }
            }
          })
        : Promise.resolve([]),
      userIds.length
        ? this.client.user.findMany({
            where: {
              id: {
                in: userIds
              }
            }
          })
        : Promise.resolve([])
    ]);

    return withLeaderboardDisplayNames(
      mapLeaderboard(rows),
      mapProfiles(profileRows),
      mapUsers(userRows)
    );
  }

  async getContestSubscriberIds(contestId: string): Promise<string[]> {
    const contest = await this.client.contest.findUnique({
      where: { id: contestId },
      select: {
        kind: true,
        leagueId: true
      }
    });
    if (!contest) {
      throw new Error("Contest not found.");
    }

    const [rosterRows, leagueMemberRows, publicUserRows] = await Promise.all([
      this.client.roster.findMany({
        where: { contestId },
        select: { userId: true }
      }),
      contest.leagueId
        ? this.client.leagueMember.findMany({
            where: { leagueId: contest.leagueId },
            select: { userId: true }
          })
        : Promise.resolve([]),
      contest.kind === "public"
        ? this.client.user.findMany({
            select: { id: true }
          })
        : Promise.resolve([])
    ]);

    return [
      ...new Set([
        ...rosterRows.map((row) => row.userId),
        ...leagueMemberRows.map((row) => row.userId),
        ...publicUserRows.map((row) => row.id)
      ])
    ];
  }

  async getMatchSubscriberIds(matchId: string): Promise<string[]> {
    const contestRows = await this.client.contest.findMany({
      where: { matchId },
      select: { id: true }
    });
    const userIds = new Set<string>();

    for (const contest of contestRows) {
      const subscribers = await this.getContestSubscriberIds(contest.id);
      subscribers.forEach((userId) => userIds.add(userId));
    }

    return [...userIds];
  }

  async getLeagueMemberIds(leagueId: string): Promise<string[]> {
    const rows = await this.client.leagueMember.findMany({
      where: { leagueId },
      select: { userId: true }
    });

    if (rows.length === 0) {
      const exists = await this.client.league.findUnique({
        where: { id: leagueId },
        select: { id: true }
      });
      if (!exists) {
        throw new Error("League not found.");
      }
    }

    return rows.map((row) => row.userId);
  }

  async getAllUserIds(): Promise<string[]> {
    const rows = await this.client.user.findMany({
      select: { id: true }
    });
    return rows.map((row) => row.id);
  }

  async getProviderStatus(): Promise<ProviderStateSnapshot> {
    const provider = await this.client.providerState.findUnique({
      where: { id: "default" },
      select: {
        status: true,
        syncedAt: true,
        lastAttemptedAt: true,
        requestDayKey: true,
        dailyRequestCount: true,
        blockedUntil: true
      }
    });

    return {
      status: (provider?.status as AppStore["provider"]["status"] | undefined) ?? "idle",
      syncedAt: provider?.syncedAt.toISOString() ?? new Date(0).toISOString(),
      lastAttemptedAt: provider?.lastAttemptedAt.toISOString() ?? new Date(0).toISOString(),
      requestDayKey: provider?.requestDayKey ?? "",
      dailyRequestCount: provider?.dailyRequestCount ?? 0,
      blockedUntil: provider?.blockedUntil?.toISOString()
    };
  }

  async getProviderSyncContext() {
    const [provider, providerMatchCount, nextMatch] =
      await Promise.all([
        this.getProviderStatus(),
        this.client.match.count({
          where: {
            id: {
              startsWith: "provider:"
            }
          }
        }),
        this.client.match.findFirst({
          where: {
            id: {
              startsWith: "provider:"
            },
            state: "scheduled",
            startsAt: {
              gt: new Date()
            }
          },
          orderBy: {
            startsAt: "asc"
          },
          select: {
            startsAt: true
          }
        })
      ]);

    const todayKey = providerBudgetDayKey();
    const usedToday = provider.requestDayKey === todayKey ? provider.dailyRequestCount : 0;

    return {
      provider,
      hasProviderFeed: providerMatchCount > 0,
      nextUpcomingProviderMatchStartsAt: nextMatch?.startsAt.toISOString() ?? null,
      remainingDailyRequestBudget: Math.max(env.CRICKET_DATA_DAILY_LIMIT - usedToday, 0),
      dailyRequestLimit: env.CRICKET_DATA_DAILY_LIMIT
    };
  }

  async reserveProviderApiRequest(limit: number, dayKey: string, blockedUntil: string) {
    return this.client.$transaction(async (tx) => {
      const existing = await tx.providerState.findUnique({
        where: { id: "default" },
        select: {
          id: true,
          status: true,
          syncedAt: true,
          lastAttemptedAt: true,
          requestDayKey: true,
          dailyRequestCount: true,
          blockedUntil: true
        }
      });

      const activeBlockedUntil =
        existing?.blockedUntil && existing.blockedUntil.getTime() > Date.now()
          ? existing.blockedUntil.toISOString()
          : undefined;
      if (activeBlockedUntil) {
        throw new Error(`Provider request budget is blocked until ${activeBlockedUntil}.`);
      }

      const currentCount = existing?.requestDayKey === dayKey ? existing.dailyRequestCount : 0;
      if (currentCount >= limit) {
        await tx.providerState.upsert({
          where: { id: "default" },
          update: {
            blockedUntil: new Date(blockedUntil),
            requestDayKey: dayKey,
            dailyRequestCount: currentCount
          },
          create: {
            id: "default",
            status: existing?.status ?? "idle",
            syncedAt: existing?.syncedAt ?? new Date(0),
            lastAttemptedAt: existing?.lastAttemptedAt ?? new Date(0),
            requestDayKey: dayKey,
            dailyRequestCount: currentCount,
            blockedUntil: new Date(blockedUntil)
          }
        });

        throw new Error(`Provider request budget exhausted for ${dayKey}.`);
      }

      const nextCount = currentCount + 1;
      await tx.providerState.upsert({
        where: { id: "default" },
        update: {
          requestDayKey: dayKey,
          dailyRequestCount: nextCount,
          blockedUntil: null
        },
        create: {
          id: "default",
          status: existing?.status ?? "idle",
          syncedAt: existing?.syncedAt ?? new Date(0),
          lastAttemptedAt: existing?.lastAttemptedAt ?? new Date(0),
          requestDayKey: dayKey,
          dailyRequestCount: nextCount,
          blockedUntil: null
        }
      });

      return {
        used: nextCount,
        remaining: Math.max(limit - nextCount, 0)
      };
    });
  }

  async releaseProviderApiRequest(dayKey: string): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const existing = await tx.providerState.findUnique({
        where: { id: "default" },
        select: {
          id: true,
          requestDayKey: true,
          dailyRequestCount: true
        }
      });

      if (!existing || existing.requestDayKey !== dayKey || existing.dailyRequestCount <= 0) {
        return;
      }

      await tx.providerState.update({
        where: { id: "default" },
        data: {
          dailyRequestCount: existing.dailyRequestCount - 1
        }
      });
    });
  }

  async blockProviderApiUntil(blockedUntil: string, dayKey: string): Promise<void> {
    const existing = await this.client.providerState.findUnique({
      where: { id: "default" },
      select: {
        id: true,
        status: true,
        syncedAt: true,
        lastAttemptedAt: true,
        requestDayKey: true,
        dailyRequestCount: true
      }
    });

    const dailyRequestCount = existing?.requestDayKey === dayKey ? existing.dailyRequestCount : 0;

    await this.client.providerState.upsert({
      where: { id: "default" },
      update: {
        requestDayKey: dayKey,
        dailyRequestCount,
        blockedUntil: new Date(blockedUntil)
      },
      create: {
        id: "default",
        status: existing?.status ?? "idle",
        syncedAt: existing?.syncedAt ?? new Date(0),
        lastAttemptedAt: existing?.lastAttemptedAt ?? new Date(0),
        requestDayKey: dayKey,
        dailyRequestCount,
        blockedUntil: new Date(blockedUntil)
      }
    });
  }

  async createLeagueRecord(userId: string, input: CreateLeagueInput): Promise<League> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const leagueId = crypto.randomUUID();
      const inviteCode = createInviteCode(input.name);
      const leagueData = {
        id: leagueId,
        name: input.name,
        description: input.description ?? null,
        visibility: input.visibility,
        createdBy: userId,
        inviteCode,
        bannerStyle: createLeagueBanner(input.visibility),
        leagueType: "season",
        maxMembers: input.maxMembers,
        squadSize: DEFAULT_LEAGUE_SQUAD_SIZE
      };

      try {
        const league = await this.client.$transaction(async (tx) => {
          await tx.league.create({
            data: leagueData
          });

          await tx.leagueMember.create({
            data: {
              leagueId,
              userId
            }
          });

          await tx.invite.create({
            data: {
              id: crypto.randomUUID(),
              leagueId,
              code: inviteCode,
              createdBy: userId
            }
          });

          const created = await tx.league.findUniqueOrThrow({
            where: { id: leagueId },
            include: {
              members: {
                select: { userId: true }
              },
              contests: {
                select: { id: true }
              },
              auctionRooms: {
                select: { id: true },
                orderBy: [{ createdAt: "desc" }],
                take: 1
              }
            }
          });

          return toLeagueDto(created);
        });

        return league;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("Failed to create a unique invite code.");
  }

  async joinLeagueByInvite(userId: string, input: JoinLeagueInput): Promise<League> {
    return this.client.$transaction(async (tx) => {
      const invite = await tx.invite.findUnique({
        where: { code: input.inviteCode }
      });

      if (!invite || (invite.expiresAt && invite.expiresAt.getTime() <= Date.now())) {
        throw new Error("Invite code is invalid.");
      }

      const leagueMeta = await tx.league.findUnique({
        where: { id: invite.leagueId },
        select: {
          id: true,
          maxMembers: true,
          members: {
            select: { userId: true }
          }
        }
      });

      if (!leagueMeta) {
        throw new Error("League not found.");
      }

      const alreadyMember = leagueMeta.members.some((member) => member.userId === userId);
      if (!alreadyMember && leagueMeta.members.length >= leagueMeta.maxMembers) {
        throw new Error("League is already full.");
      }

      await tx.leagueMember.upsert({
        where: {
          leagueId_userId: {
            leagueId: invite.leagueId,
            userId
          }
        },
        update: {},
        create: {
          leagueId: invite.leagueId,
          userId
        }
      });

      const league = await tx.league.findUniqueOrThrow({
        where: { id: invite.leagueId },
        include: {
          members: {
            select: { userId: true }
          },
          contests: {
            select: { id: true }
          },
          auctionRooms: {
            select: { id: true },
            orderBy: [{ createdAt: "desc" }],
            take: 1
          }
        }
      });

      return toLeagueDto(league);
    });
  }

  async deleteLeagueRecord(userId: string, leagueId: string): Promise<{ leagueId: string }> {
    return this.client.$transaction(async (tx) => {
      const league = await tx.league.findUnique({
        where: { id: leagueId },
        select: {
          id: true,
          createdBy: true,
          visibility: true
        }
      });

      if (!league) {
        throw new Error("League not found.");
      }

      if (league.createdBy !== userId) {
        throw new Error("Only the league creator can delete this league.");
      }

      const startedAuction = await tx.auctionRoom.findFirst({
        where: {
          leagueId,
          state: {
            in: ["live", "completed"]
          }
        },
        select: { id: true }
      });

      if (startedAuction) {
        throw new Error("Cannot delete a league after the auction has started.");
      }

      await tx.invite.deleteMany({
        where: { leagueId }
      });

      await tx.league.delete({
        where: { id: leagueId }
      });

      return { leagueId };
    });
  }

  async submitRosterRecord(
    userId: string,
    contestId: string,
    input: SubmitRosterInput | BuildRosterInput
  ): Promise<Roster> {
    return this.client.$transaction(async (tx) => {
      const contestRow = await tx.contest.findUnique({
        where: { id: contestId }
      });
      if (!contestRow) {
        throw new Error("Contest not found.");
      }

      const contest = mapContests([contestRow])[0];
      const matchRow = await tx.match.findUnique({
        where: { id: contest.matchId }
      });
      if (!matchRow) {
        throw new Error("Match not found.");
      }

      const match = mapMatches([matchRow])[0];
      const [matchPlayersRows, existingRow] = await Promise.all([
        tx.player.findMany({
          where: {
            teamId: {
              in: [match.homeTeamId, match.awayTeamId]
            }
          }
        }),
        tx.roster.findUnique({
          where: {
            contestId_userId: {
              contestId,
              userId
            }
          }
        })
      ]);

      const matchPlayers = mapPlayers(matchPlayersRows);
      const validation = validateRoster(contest, match, matchPlayers, input, new Date());
      if (!validation.valid) {
        throw new Error(validation.errors.join(" "));
      }

      const submittedAt = new Date();
      const rosterPayload = {
        contestId,
        userId,
        players: [
          ...input.starterPlayerIds.map((playerId) => ({ playerId, isStarter: true })),
          ...input.substitutePlayerIds.map((playerId) => ({ playerId, isStarter: false }))
        ],
        captainPlayerId: input.captainPlayerId,
        viceCaptainPlayerId: input.viceCaptainPlayerId,
        submittedAt,
        locked: submittedAt >= new Date(contest.lockTime)
      };

      const savedRoster = await tx.roster.upsert({
        where: {
          contestId_userId: {
            contestId,
            userId
          }
        },
        update: rosterPayload,
        create: {
          id: existingRow?.id ?? crypto.randomUUID(),
          ...rosterPayload
        }
      });

      const [rosterRows, eventRows, statLineRows, previousEntries] = await Promise.all([
        tx.roster.findMany({
          where: { contestId }
        }),
        tx.fantasyScoreEvent.findMany({
          where: { matchId: contest.matchId }
        }),
        tx.playerMatchStatLine.findMany({
          where: { matchId: contest.matchId }
        }),
        tx.leaderboardEntry.findMany({
          where: { contestId }
        })
      ]);

      const leaderboardEntries = buildLeaderboardEntries(
        contest,
        mapRosters(rosterRows),
        matchPlayers,
        mapScoreEvents(eventRows),
        mapPlayerMatchStatLines(statLineRows),
        mapLeaderboard(previousEntries)
      );

      await tx.leaderboardEntry.deleteMany({
        where: { contestId }
      });

      if (leaderboardEntries.length) {
        await tx.leaderboardEntry.createMany({
          data: leaderboardEntries.map((entry) => ({
            id: entry.id,
            contestId: entry.contestId,
            userId: entry.userId,
            points: entry.points,
            rank: entry.rank,
            previousRank: entry.previousRank,
            trend: entry.trend,
            projectedPoints: entry.projectedPoints ?? null
          }))
        });
      }

      return toRosterDto(savedRoster);
    });
  }

  async answerPredictionRecord(
    userId: string,
    questionId: string,
    input: PredictionAnswerInput
  ): Promise<PredictionAnswer> {
    return this.client.$transaction(async (tx) => {
      const questionRow = await tx.predictionQuestion.findUnique({
        where: { id: questionId }
      });
      if (!questionRow) {
        throw new Error("Prediction question not found.");
      }

      const question = mapQuestions([questionRow])[0];
      if (!canSubmitPrediction(question)) {
        throw new Error("Prediction is locked.");
      }

      if (!question.options.some((option) => option.id === input.optionId)) {
        throw new Error("Prediction option not found.");
      }

      const answer = await tx.predictionAnswer.upsert({
        where: {
          questionId_userId: {
            questionId,
            userId
          }
        },
        update: {
          optionId: input.optionId,
          submittedAt: new Date()
        },
        create: {
          id: crypto.randomUUID(),
          questionId,
          userId,
          optionId: input.optionId,
          submittedAt: new Date()
        }
      });

      return mapAnswers([answer])[0];
    });
  }

  async settlePredictionRecord(
    questionId: string,
    correctOptionId: string
  ): Promise<{ settledCount: number; correctOptionId: string }> {
    return this.client.$transaction(async (tx) => {
      const questionRow = await tx.predictionQuestion.findUnique({
        where: { id: questionId }
      });
      if (!questionRow) {
        throw new Error("Prediction question not found.");
      }

      const question = mapQuestions([questionRow])[0];
      if (question.state === "settled") {
        throw new Error("Prediction already settled.");
      }

      if (!question.options.some((option) => option.id === correctOptionId)) {
        throw new Error("Prediction option not found.");
      }

      const answerRows = await tx.predictionAnswer.findMany({
        where: { questionId }
      });
      const answers = mapAnswers(answerRows);
      const userIds = [...new Set(answers.map((answer) => answer.userId))];
      const [profileRows, inventoryRows, cosmeticRows] = await Promise.all([
        tx.profile.findMany({
          where: {
            userId: {
              in: userIds
            }
          }
        }),
        tx.userInventory.findMany({
          where: {
            userId: {
              in: userIds
            }
          }
        }),
        question.cosmeticRewardId
          ? tx.cosmeticItem.findMany({
              where: { id: question.cosmeticRewardId }
            })
          : Promise.resolve([])
      ]);

      const profiles = new Map(mapProfiles(profileRows).map((profile) => [profile.userId, profile]));
      const inventories = new Map(
        mapInventories(inventoryRows).map((inventory) => [inventory.userId, inventory])
      );
      const cosmetic = question.cosmeticRewardId
        ? mapCosmetics(cosmeticRows)[0]
        : undefined;
      const settledAt = new Date().toISOString();
      const nextResults: PredictionResult[] = [];
      const nextTransactions: XPTransaction[] = [];
      const nextUnlocks: CosmeticUnlock[] = [];

      for (const answer of answers) {
        const profile = profiles.get(answer.userId);
        const inventory = inventories.get(answer.userId);
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
        nextResults.push(settled.result);
        nextTransactions.push(settled.transaction);

        profile.xp += settled.result.awardedXp;
        profile.level = levelFromXp(profile.xp);
        profile.streak = settled.result.streak;

        if (
          settled.result.awardedBadgeId &&
          !inventory.badgeIds.includes(settled.result.awardedBadgeId)
        ) {
          inventory.badgeIds = [...inventory.badgeIds, settled.result.awardedBadgeId];
        }

        if (settled.result.awardedCosmeticId && cosmetic) {
          const unlocked = unlockCosmetic(
            inventory,
            answer.userId,
            cosmetic,
            "prediction",
            settledAt
          );
          inventories.set(answer.userId, unlocked.inventory);
          if (unlocked.unlock) {
            nextUnlocks.push(unlocked.unlock);
          }
        }
      }

      await tx.predictionQuestion.update({
        where: { id: questionId },
        data: {
          state: "settled"
        }
      });

      await tx.predictionResult.deleteMany({
        where: { questionId }
      });
      if (nextResults.length) {
        await tx.predictionResult.createMany({
          data: nextResults.map((result) => ({
            id: result.id,
            questionId: result.questionId,
            userId: result.userId,
            correctOptionId: result.correctOptionId,
            awardedXp: result.awardedXp,
            awardedBadgeId: result.awardedBadgeId ?? null,
            awardedCosmeticId: result.awardedCosmeticId ?? null,
            streak: result.streak,
            settledAt: new Date(result.settledAt)
          }))
        });
      }

      if (nextTransactions.length) {
        await tx.xPTransaction.createMany({
          data: nextTransactions.map((entry) => ({
            id: entry.id,
            userId: entry.userId,
            source: entry.source,
            amount: entry.amount,
            description: entry.description,
            createdAt: new Date(entry.createdAt)
          }))
        });
      }

      for (const profile of profiles.values()) {
        await tx.profile.update({
          where: { userId: profile.userId },
          data: {
            xp: profile.xp,
            level: profile.level,
            streak: profile.streak
          }
        });
      }

      for (const inventory of inventories.values()) {
        await tx.userInventory.update({
          where: { userId: inventory.userId },
          data: {
            badgeIds: inventory.badgeIds,
            cosmeticIds: inventory.cosmeticIds,
            equipped: inputJson(inventory.equipped)
          }
        });
      }

      if (nextUnlocks.length) {
        await tx.cosmeticUnlock.createMany({
          data: nextUnlocks.map((unlock) => ({
            id: unlock.id,
            userId: unlock.userId,
            cosmeticId: unlock.cosmeticId,
            source: unlock.source,
            unlockedAt: new Date(unlock.unlockedAt)
          })),
          skipDuplicates: true
        });
      }

      return {
        settledCount: answers.length,
        correctOptionId
      };
    });
  }

  async equipCosmeticRecord(userId: string, cosmeticId: string): Promise<{ cosmeticId: string }> {
    return this.client.$transaction(async (tx) => {
      const [inventoryRow, profileRow, cosmeticRow] = await Promise.all([
        tx.userInventory.findUnique({
          where: { userId }
        }),
        tx.profile.findUnique({
          where: { userId }
        }),
        tx.cosmeticItem.findUnique({
          where: { id: cosmeticId }
        })
      ]);

      if (!inventoryRow) {
        throw new Error("Inventory not found.");
      }

      if (!profileRow) {
        throw new Error("Unknown profile.");
      }

      if (!cosmeticRow) {
        throw new Error("Cosmetic not found.");
      }

      const updated = equipCosmetic(
        mapInventories([inventoryRow])[0],
        mapProfiles([profileRow])[0],
        mapCosmetics([cosmeticRow])[0]
      );

      await Promise.all([
        tx.userInventory.update({
          where: { userId },
          data: {
            cosmeticIds: updated.inventory.cosmeticIds,
            badgeIds: updated.inventory.badgeIds,
            equipped: inputJson(updated.inventory.equipped)
          }
        }),
        tx.profile.update({
          where: { userId },
          data: {
            equippedCosmetics: inputJson(updated.profile.equippedCosmetics)
          }
        })
      ]);

      return { cosmeticId };
    });
  }

  async applyCorrectionRecord(
    matchId: string,
    playerId: string,
    label: string,
    points: number
  ): Promise<{ status: string }> {
    return this.client.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId }
      });
      if (!match) {
        throw new Error("Match not found.");
      }

      await tx.fantasyScoreEvent.create({
        data: {
          id: crypto.randomUUID(),
          matchId,
          playerId,
          label,
          points
        }
      });

      const [contestRows, playerRows, statLineRows, scoreEventRows] = await Promise.all([
        tx.contest.findMany({
          where: { matchId }
        }),
        tx.player.findMany({
          where: {
            teamId: {
              in: [match.homeTeamId, match.awayTeamId]
            }
          }
        }),
        tx.playerMatchStatLine.findMany({
          where: { matchId }
        }),
        tx.fantasyScoreEvent.findMany({
          where: { matchId }
        })
      ]);

      const players = mapPlayers(playerRows);
      const statLines = mapPlayerMatchStatLines(statLineRows);
      const events = mapScoreEvents(scoreEventRows);
      const nextEntries: LeaderboardEntry[] = [];

      for (const contest of mapContests(contestRows)) {
        const [rosterRows, previousEntries] = await Promise.all([
          tx.roster.findMany({
            where: { contestId: contest.id }
          }),
          tx.leaderboardEntry.findMany({
            where: { contestId: contest.id }
          })
        ]);

        nextEntries.push(
          ...buildLeaderboardEntries(
            contest,
            mapRosters(rosterRows),
            players,
            events,
            statLines,
            mapLeaderboard(previousEntries)
          )
        );
      }

      await tx.leaderboardEntry.deleteMany({
        where: {
          contestId: {
            in: contestRows.map((contest) => contest.id)
          }
        }
      });

      if (nextEntries.length) {
        await tx.leaderboardEntry.createMany({
          data: nextEntries.map((entry) => ({
            id: entry.id,
            contestId: entry.contestId,
            userId: entry.userId,
            points: entry.points,
            rank: entry.rank,
            previousRank: entry.previousRank,
            trend: entry.trend,
            projectedPoints: entry.projectedPoints ?? null
          }))
        });
      }

      return { status: "corrected" };
    });
  }

  async rebuildAllLeaderboards(): Promise<void> {
    const contestRows = await this.client.contest.findMany();
    for (const contestRow of contestRows) {
      const contest = mapContests([contestRow])[0];
      const match = await this.client.match.findUnique({
        where: { id: contest.matchId }
      });
      if (!match) {
        continue;
      }

      const [rosterRows, playerRows, statLineRows, eventRows, previousEntries] = await Promise.all([
        this.client.roster.findMany({
          where: { contestId: contest.id }
        }),
        this.client.player.findMany({
          where: {
            teamId: {
              in: [match.homeTeamId, match.awayTeamId]
            }
          }
        }),
        this.client.playerMatchStatLine.findMany({
          where: { matchId: contest.matchId }
        }),
        this.client.fantasyScoreEvent.findMany({
          where: { matchId: contest.matchId }
        }),
        this.client.leaderboardEntry.findMany({
          where: { contestId: contest.id }
        })
      ]);

      const entries = buildLeaderboardEntries(
        contest,
        mapRosters(rosterRows),
        mapPlayers(playerRows),
        mapScoreEvents(eventRows),
        mapPlayerMatchStatLines(statLineRows),
        mapLeaderboard(previousEntries)
      );

      await this.client.$transaction(async (tx) => {
        await tx.leaderboardEntry.deleteMany({
          where: { contestId: contest.id }
        });

        if (entries.length) {
          await tx.leaderboardEntry.createMany({
            data: entries.map((entry) => ({
              id: entry.id,
              contestId: entry.contestId,
              userId: entry.userId,
              points: entry.points,
              rank: entry.rank,
              previousRank: entry.previousRank,
              trend: entry.trend,
              projectedPoints: entry.projectedPoints ?? null
            }))
          });
        }
      });
    }
  }

  async applyProviderSnapshot(snapshot: ProviderSyncSnapshot): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const [
        currentContestRows,
        currentQuestionRows,
        currentMatchRows,
        currentPlayerRows,
        currentTeamRows
      ] = await Promise.all([
        tx.contest.findMany({
          where: {
            id: {
              startsWith: "provider:"
            }
          },
          select: { id: true }
        }),
        tx.predictionQuestion.findMany({
          where: {
            id: {
              startsWith: "provider:"
            }
          },
          select: { id: true }
        }),
        tx.match.findMany({
          where: {
            id: {
              startsWith: "provider:"
            }
          },
          select: { id: true }
        }),
        tx.player.findMany({
          where: {
            id: {
              startsWith: "provider:"
            }
          },
          select: { id: true }
        }),
        tx.team.findMany({
          where: {
            id: {
              startsWith: "provider:"
            }
          },
          select: { id: true }
        })
      ]);

      const snapshotContestIds = new Set(snapshot.contests.map((contest) => contest.id));
      const snapshotQuestionIds = new Set(snapshot.questions.map((question) => question.id));
      const snapshotMatchIds = new Set(snapshot.matches.map((match) => match.id));
      const snapshotPlayerIds = new Set(snapshot.players.map((player) => player.id));
      const snapshotTeamIds = new Set(snapshot.teams.map((team) => team.id));

      const removedContestIds = currentContestRows
        .map((row) => row.id)
        .filter((id) => !snapshotContestIds.has(id));
      const removedQuestionIds = currentQuestionRows
        .map((row) => row.id)
        .filter((id) => !snapshotQuestionIds.has(id));
      const removedMatchIds = currentMatchRows
        .map((row) => row.id)
        .filter((id) => !snapshotMatchIds.has(id));
      const removedPlayerIds = currentPlayerRows
        .map((row) => row.id)
        .filter((id) => !snapshotPlayerIds.has(id));
      const removedTeamIds = currentTeamRows
        .map((row) => row.id)
        .filter((id) => !snapshotTeamIds.has(id));

      for (const team of snapshot.teams) {
        await tx.team.upsert({
          where: { id: team.id },
          update: {
            name: team.name,
            shortName: team.shortName,
            city: team.city
          },
          create: team
        });
      }

      for (const player of snapshot.players) {
        await tx.player.upsert({
          where: { id: player.id },
          update: {
            name: player.name,
            teamId: player.teamId,
            role: player.role,
            rating: player.rating,
            nationality: player.nationality,
            selectionPercent: player.selectionPercent
          },
          create: {
            id: player.id,
            name: player.name,
            teamId: player.teamId,
            role: player.role,
            rating: player.rating,
            nationality: player.nationality,
            selectionPercent: player.selectionPercent
          }
        });
      }

      for (const match of snapshot.matches) {
        await tx.match.upsert({
          where: { id: match.id },
          update: {
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            startsAt: new Date(match.startsAt),
            venue: match.venue,
            state: match.state
          },
          create: {
            id: match.id,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            startsAt: new Date(match.startsAt),
            venue: match.venue,
            state: match.state
          }
        });
      }

      for (const contest of snapshot.contests) {
        await tx.contest.upsert({
          where: { id: contest.id },
          update: {
            name: contest.name,
            kind: contest.kind,
            matchId: contest.matchId,
            leagueId: contest.leagueId ?? null,
            rosterRules: inputJson(contest.rosterRules),
            lockTime: new Date(contest.lockTime),
            rewards: inputJson(contest.rewards)
          },
          create: {
            id: contest.id,
            name: contest.name,
            kind: contest.kind,
            matchId: contest.matchId,
            leagueId: contest.leagueId ?? null,
            rosterRules: inputJson(contest.rosterRules),
            lockTime: new Date(contest.lockTime),
            rewards: inputJson(contest.rewards)
          }
        });
      }

      for (const question of snapshot.questions) {
        await tx.predictionQuestion.upsert({
          where: { id: question.id },
          update: {
            matchId: question.matchId,
            prompt: question.prompt,
            category: question.category,
            options: inputJson(question.options),
            locksAt: new Date(question.locksAt),
            resolvesAt: new Date(question.resolvesAt),
            state: question.state,
            xpReward: question.xpReward,
            badgeRewardId: question.badgeRewardId ?? null,
            cosmeticRewardId: question.cosmeticRewardId ?? null
          },
          create: {
            id: question.id,
            matchId: question.matchId,
            prompt: question.prompt,
            category: question.category,
            options: inputJson(question.options),
            locksAt: new Date(question.locksAt),
            resolvesAt: new Date(question.resolvesAt),
            state: question.state,
            xpReward: question.xpReward,
            badgeRewardId: question.badgeRewardId ?? null,
            cosmeticRewardId: question.cosmeticRewardId ?? null
          }
        });
      }

      await tx.playerMatchStatLine.deleteMany({
        where: {
          matchId: {
            startsWith: "provider:"
          }
        }
      });

      if (snapshot.statLines.length) {
        await tx.playerMatchStatLine.createMany({
          data: snapshot.statLines.map((line) => ({
            id: line.id,
            matchId: line.matchId,
            playerId: line.playerId,
            runs: line.runs,
            balls: line.balls,
            fours: line.fours,
            sixes: line.sixes,
            wickets: line.wickets,
            maidens: line.maidens,
            dotBalls: line.dotBalls,
            catches: line.catches,
            stumpings: line.stumpings,
            runOuts: line.runOuts,
            runsConceded: line.runsConceded,
            ballsBowled: line.ballsBowled,
            battingStrikeRate: line.battingStrikeRate ?? null,
            bowlingEconomy: line.bowlingEconomy ?? null,
            didPlay: line.didPlay,
            didBat: line.didBat,
            didBowl: line.didBowl,
            didField: line.didField,
            sourceUpdatedAt: new Date(line.sourceUpdatedAt)
          }))
        });
      }

      await tx.fantasyScoreEvent.deleteMany({
        where: {
          id: {
            startsWith: "provider:score:"
          }
        }
      });

      if (snapshot.scoreEvents.length) {
        await tx.fantasyScoreEvent.createMany({
          data: snapshot.scoreEvents.map((event) => ({
            id: event.id,
            matchId: event.matchId,
            playerId: event.playerId,
            label: event.label,
            points: event.points,
            createdAt: new Date(event.createdAt)
          }))
        });
      }

      const providerRosters = mapRosters(
        await tx.roster.findMany({
          where: {
            contestId: {
              startsWith: "provider:"
            }
          }
        })
      );
      const invalidProviderRosterIds = providerRosters
        .filter((roster) => {
          if (!snapshotContestIds.has(roster.contestId)) {
            return true;
          }

          if (
            !snapshotPlayerIds.has(roster.captainPlayerId) ||
            !snapshotPlayerIds.has(roster.viceCaptainPlayerId)
          ) {
            return true;
          }

          return roster.players.some((player) => !snapshotPlayerIds.has(player.playerId));
        })
        .map((roster) => roster.id);

      if (invalidProviderRosterIds.length) {
        await tx.roster.deleteMany({
          where: {
            id: {
              in: invalidProviderRosterIds
            }
          }
        });
      }

      if (removedContestIds.length) {
        await tx.leaderboardEntry.deleteMany({
          where: {
            contestId: {
              in: removedContestIds
            }
          }
        });
        await tx.roster.deleteMany({
          where: {
            contestId: {
              in: removedContestIds
            }
          }
        });
        await tx.contest.deleteMany({
          where: {
            id: {
              in: removedContestIds
            }
          }
        });
      }

      if (removedQuestionIds.length) {
        await tx.predictionAnswer.deleteMany({
          where: {
            questionId: {
              in: removedQuestionIds
            }
          }
        });
        await tx.predictionResult.deleteMany({
          where: {
            questionId: {
              in: removedQuestionIds
            }
          }
        });
        await tx.predictionQuestion.deleteMany({
          where: {
            id: {
              in: removedQuestionIds
            }
          }
        });
      }

      if (removedMatchIds.length) {
        await tx.match.deleteMany({
          where: {
            id: {
              in: removedMatchIds
            }
          }
        });
      }

      if (removedPlayerIds.length) {
        await tx.player.deleteMany({
          where: {
            id: {
              in: removedPlayerIds
            }
          }
        });
      }

      if (removedTeamIds.length) {
        await tx.team.deleteMany({
          where: {
            id: {
              in: removedTeamIds
            }
          }
        });
      }

      const providerContests = snapshot.contests;
      const providerStatLines = snapshot.statLines;
      const providerEvents = mapScoreEvents(
        await tx.fantasyScoreEvent.findMany({
          where: {
            matchId: {
              startsWith: "provider:"
            }
          }
        })
      );
      const matchMap = new Map(snapshot.matches.map((match) => [match.id, match]));
      const refreshedRosters = mapRosters(
        await tx.roster.findMany({
          where: {
            contestId: {
              in: providerContests.map((contest) => contest.id)
            }
          }
        })
      );
      const previousEntries = mapLeaderboard(
        await tx.leaderboardEntry.findMany({
          where: {
            contestId: {
              startsWith: "provider:"
            }
          }
        })
      );
      const previousEntriesByContest = new Map<string, LeaderboardEntry[]>();
      for (const entry of previousEntries) {
        const entries = previousEntriesByContest.get(entry.contestId) ?? [];
        entries.push(entry);
        previousEntriesByContest.set(entry.contestId, entries);
      }

      await tx.leaderboardEntry.deleteMany({
        where: {
          contestId: {
            startsWith: "provider:"
          }
        }
      });

      const nextEntries: LeaderboardEntry[] = [];
      for (const contest of providerContests) {
        const match = matchMap.get(contest.matchId);
        if (!match) {
          continue;
        }

        const contestPlayers = snapshot.players.filter(
          (player) =>
            player.teamId === match.homeTeamId || player.teamId === match.awayTeamId
        );
        const contestStatLines = providerStatLines.filter(
          (line) => line.matchId === contest.matchId
        );
        const contestEvents = providerEvents.filter((event) => event.matchId === contest.matchId);
        const contestRosters = refreshedRosters.filter((roster) => roster.contestId === contest.id);
        const previousContestEntries = previousEntriesByContest.get(contest.id) ?? [];

        nextEntries.push(
          ...buildLeaderboardEntries(
            contest,
            contestRosters,
            contestPlayers,
            contestEvents,
            contestStatLines,
            previousContestEntries
          )
        );
      }

      if (nextEntries.length) {
        await tx.leaderboardEntry.createMany({
          data: nextEntries.map((entry) => ({
            id: entry.id,
            contestId: entry.contestId,
            userId: entry.userId,
            points: entry.points,
            rank: entry.rank,
            previousRank: entry.previousRank,
            trend: entry.trend,
            projectedPoints: entry.projectedPoints ?? null
          }))
        });
      }

      await tx.providerState.upsert({
        where: { id: "default" },
        update: {
          status: "ready",
          syncedAt: new Date(snapshot.syncedAt),
          lastAttemptedAt: new Date()
        },
        create: {
          id: "default",
          status: "ready",
          syncedAt: new Date(snapshot.syncedAt),
          lastAttemptedAt: new Date()
        }
      });
    }, SNAPSHOT_TRANSACTION_OPTIONS);
  }

  async initialize(seedStore: AppStore): Promise<void> {
    const userCount = await this.client.user.count();
    if (userCount === 0) {
      await this.seedDatabase(seedStore);
      return;
    }

    await this.client.profile.updateMany({
      where: {
        onboardingCompleted: false,
        username: { not: "" },
        favoriteTeamId: { not: null }
      },
      data: {
        onboardingCompleted: true
      }
    });
  }

  private async seedDatabase(store: AppStore): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.session.deleteMany();
      await tx.authCredential.deleteMany();
      await tx.predictionAnswer.deleteMany();
      await tx.predictionResult.deleteMany();
      await tx.leaderboardEntry.deleteMany();
      await tx.fantasyScoreEvent.deleteMany();
      await tx.roster.deleteMany();
      await tx.cosmeticUnlock.deleteMany();
      await tx.xPTransaction.deleteMany();
      await tx.invite.deleteMany();
      await tx.friendship.deleteMany();
      await tx.predictionQuestion.deleteMany();
      await tx.contest.deleteMany();
      await tx.league.deleteMany();
      await tx.match.deleteMany();
      await tx.player.deleteMany();
      await tx.team.deleteMany();
      await tx.badge.deleteMany();
      await tx.cosmeticItem.deleteMany();
      await tx.userInventory.deleteMany();
      await tx.profile.deleteMany();
      await tx.user.deleteMany();
      await tx.providerState.deleteMany();

      if (store.users.length) {
        await tx.user.createMany({
          data: store.users.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            isAdmin: user.isAdmin,
            createdAt: new Date(user.createdAt)
          }))
        });
      }

      if (store.credentials.length) {
        await tx.authCredential.createMany({
          data: store.credentials.map((credential) => ({
            userId: credential.userId,
            passwordHash: credential.passwordHash,
            updatedAt: new Date(credential.updatedAt)
          }))
        });
      }

      if (store.profiles.length) {
        await tx.profile.createMany({
          data: store.profiles.map((profile) => ({
            userId: profile.userId,
            username: profile.username,
            bio: profile.bio ?? null,
            favoriteTeamId: profile.favoriteTeamId ?? null,
            xp: profile.xp,
            level: profile.level,
            streak: profile.streak,
            onboardingCompleted: profile.onboardingCompleted,
            equippedCosmetics: inputJson(profile.equippedCosmetics)
          }))
        });
      }

      if (store.inventories.length) {
        await tx.userInventory.createMany({
          data: store.inventories.map((inventory) => ({
            userId: inventory.userId,
            cosmeticIds: inventory.cosmeticIds,
            badgeIds: inventory.badgeIds,
            equipped: inputJson(inventory.equipped)
          }))
        });
      }

      if (store.sessions.length) {
        await tx.session.createMany({
          data: store.sessions.map((session) => ({
            token: session.token,
            userId: session.userId,
            createdAt: new Date(session.createdAt),
            expiresAt: new Date(session.expiresAt)
          }))
        });
      }

      if (store.friendships.length) {
        await tx.friendship.createMany({
          data: store.friendships.map((friendship) => ({
            id: friendship.id,
            requesterId: friendship.requesterId,
            addresseeId: friendship.addresseeId,
            pairKey: friendshipPairKey(friendship.requesterId, friendship.addresseeId),
            status: friendship.status,
            createdAt: new Date(friendship.createdAt)
          }))
        });
      }

      if (store.teams.length) {
        await tx.team.createMany({
          data: store.teams
        });
      }

      if (store.players.length) {
        await tx.player.createMany({
          data: store.players.map((player) => ({
            id: player.id,
            name: player.name,
            teamId: player.teamId,
            role: player.role,
            rating: player.rating,
            nationality: player.nationality,
            selectionPercent: player.selectionPercent
          }))
        });
      }

      if (store.matches.length) {
        await tx.match.createMany({
          data: store.matches.map((match) => ({
            id: match.id,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            startsAt: new Date(match.startsAt),
            venue: match.venue,
            state: match.state
          }))
        });
      }

      if (store.leagues.length) {
        await tx.league.createMany({
          data: store.leagues.map((league) => ({
            id: league.id,
            name: league.name,
            description: league.description ?? null,
            visibility: league.visibility,
            createdBy: league.createdBy,
            inviteCode: league.inviteCode,
            bannerStyle: league.bannerStyle
          }))
        });
      }

      const leagueMembers = store.leagues.flatMap((league) =>
        league.memberIds.map((userId) => ({
          leagueId: league.id,
          userId
        }))
      );

      if (leagueMembers.length) {
        await tx.leagueMember.createMany({
          data: leagueMembers
        });
      }

      if (store.invites.length) {
        await tx.invite.createMany({
          data: store.invites.map((invite) => ({
            id: invite.id,
            leagueId: invite.leagueId,
            code: invite.code,
            createdBy: invite.createdBy,
            createdAt: new Date(invite.createdAt),
            expiresAt: toDate(invite.expiresAt)
          }))
        });
      }

      if (store.contests.length) {
        await tx.contest.createMany({
          data: store.contests.map((contest) => ({
            id: contest.id,
            name: contest.name,
            kind: contest.kind,
            matchId: contest.matchId,
            leagueId: contest.leagueId ?? null,
            rosterRules: inputJson(contest.rosterRules),
            lockTime: new Date(contest.lockTime),
            rewards: inputJson(contest.rewards)
          }))
        });
      }

      if (store.rosters.length) {
        await tx.roster.createMany({
          data: store.rosters.map((roster) => ({
            id: roster.id,
            contestId: roster.contestId,
            userId: roster.userId,
            players: inputJson(roster.players),
            captainPlayerId: roster.captainPlayerId,
            viceCaptainPlayerId: roster.viceCaptainPlayerId,
            submittedAt: new Date(roster.submittedAt),
            locked: roster.locked
          }))
        });
      }

      if (store.playerMatchStatLines.length) {
        await tx.playerMatchStatLine.createMany({
          data: store.playerMatchStatLines.map((line) => ({
            id: line.id,
            matchId: line.matchId,
            playerId: line.playerId,
            runs: line.runs,
            balls: line.balls,
            fours: line.fours,
            sixes: line.sixes,
            wickets: line.wickets,
            maidens: line.maidens,
            dotBalls: line.dotBalls,
            catches: line.catches,
            stumpings: line.stumpings,
            runOuts: line.runOuts,
            runsConceded: line.runsConceded,
            ballsBowled: line.ballsBowled,
            battingStrikeRate: line.battingStrikeRate ?? null,
            bowlingEconomy: line.bowlingEconomy ?? null,
            didPlay: line.didPlay,
            didBat: line.didBat,
            didBowl: line.didBowl,
            didField: line.didField,
            sourceUpdatedAt: new Date(line.sourceUpdatedAt)
          }))
        });
      }

      if (store.scoreEvents.length) {
        await tx.fantasyScoreEvent.createMany({
          data: store.scoreEvents.map((event) => ({
            id: event.id,
            matchId: event.matchId,
            playerId: event.playerId,
            label: event.label,
            points: event.points,
            createdAt: new Date(event.createdAt)
          }))
        });
      }

      if (store.leaderboard.length) {
        await tx.leaderboardEntry.createMany({
          data: store.leaderboard.map((entry) => ({
            id: entry.id,
            contestId: entry.contestId,
            userId: entry.userId,
            points: entry.points,
            rank: entry.rank,
            previousRank: entry.previousRank,
            trend: entry.trend,
            projectedPoints: entry.projectedPoints ?? null
          }))
        });
      }

      if (store.badges.length) {
        await tx.badge.createMany({
          data: store.badges.map((badge) => ({
            id: badge.id,
            label: badge.label,
            description: badge.description,
            category: badge.category,
            seasonId: badge.seasonId ?? null
          }))
        });
      }

      if (store.questions.length) {
        await tx.predictionQuestion.createMany({
          data: store.questions.map((question) => ({
            id: question.id,
            matchId: question.matchId,
            prompt: question.prompt,
            category: question.category,
            options: inputJson(question.options),
            locksAt: new Date(question.locksAt),
            resolvesAt: new Date(question.resolvesAt),
            state: question.state,
            xpReward: question.xpReward,
            badgeRewardId: question.badgeRewardId ?? null,
            cosmeticRewardId: question.cosmeticRewardId ?? null
          }))
        });
      }

      if (store.answers.length) {
        await tx.predictionAnswer.createMany({
          data: store.answers.map((answer) => ({
            id: answer.id,
            questionId: answer.questionId,
            userId: answer.userId,
            optionId: answer.optionId,
            submittedAt: new Date(answer.submittedAt)
          }))
        });
      }

      if (store.results.length) {
        await tx.predictionResult.createMany({
          data: store.results.map((result) => ({
            id: result.id,
            questionId: result.questionId,
            userId: result.userId,
            correctOptionId: result.correctOptionId,
            awardedXp: result.awardedXp,
            awardedBadgeId: result.awardedBadgeId ?? null,
            awardedCosmeticId: result.awardedCosmeticId ?? null,
            streak: result.streak,
            settledAt: new Date(result.settledAt)
          }))
        });
      }

      if (store.cosmetics.length) {
        await tx.cosmeticItem.createMany({
          data: store.cosmetics.map((cosmetic) => ({
            id: cosmetic.id,
            name: cosmetic.name,
            description: cosmetic.description,
            category: cosmetic.category,
            rarity: cosmetic.rarity,
            themeToken: cosmetic.themeToken,
            gameplayAffecting: cosmetic.gameplayAffecting,
            transferable: cosmetic.transferable,
            redeemable: cosmetic.redeemable,
            resaleValue: cosmetic.resaleValue
          }))
        });
      }

      if (store.cosmeticUnlocks.length) {
        await tx.cosmeticUnlock.createMany({
          data: store.cosmeticUnlocks.map((unlock) => ({
            id: unlock.id,
            userId: unlock.userId,
            cosmeticId: unlock.cosmeticId,
            source: unlock.source,
            unlockedAt: new Date(unlock.unlockedAt)
          }))
        });
      }

      if (store.xpTransactions.length) {
        await tx.xPTransaction.createMany({
          data: store.xpTransactions.map((entry) => ({
            id: entry.id,
            userId: entry.userId,
            source: entry.source,
            amount: entry.amount,
            description: entry.description,
            createdAt: new Date(entry.createdAt)
          }))
        });
      }

      const providerStateData: ProviderStateCreateInput = {
        id: "default",
        status: store.provider.status,
        syncedAt: new Date(store.provider.syncedAt),
        lastAttemptedAt: new Date(store.provider.lastAttemptedAt),
        requestDayKey: "",
        dailyRequestCount: 0,
        blockedUntil: null
      };

      await tx.providerState.create({
        data: providerStateData
      });
    }, SNAPSHOT_TRANSACTION_OPTIONS);
  }

  async updateProviderState(patch: Partial<ProviderStateSnapshot>): Promise<void> {
    const existing = (await this.client.providerState.findUnique({
      where: { id: "default" },
      select: {
        id: true,
        status: true,
        syncedAt: true,
        lastAttemptedAt: true,
        requestDayKey: true,
        dailyRequestCount: true,
        blockedUntil: true
      }
    })) as ProviderStateRow | null;

    const updateData: ProviderStateUpdateInput = {
      status: patch.status ?? existing?.status ?? "idle",
      syncedAt: patch.syncedAt
        ? new Date(patch.syncedAt)
        : existing?.syncedAt ?? new Date(0),
      lastAttemptedAt: patch.lastAttemptedAt
        ? new Date(patch.lastAttemptedAt)
        : existing?.lastAttemptedAt ?? new Date(0),
      requestDayKey: patch.requestDayKey ?? existing?.requestDayKey ?? "",
      dailyRequestCount: patch.dailyRequestCount ?? existing?.dailyRequestCount ?? 0,
      blockedUntil: patch.blockedUntil
        ? new Date(patch.blockedUntil)
        : patch.blockedUntil === undefined
          ? existing?.blockedUntil ?? null
          : null
    };

    const createData: ProviderStateCreateInput = {
      id: "default",
      status: patch.status ?? existing?.status ?? "idle",
      syncedAt: patch.syncedAt
        ? new Date(patch.syncedAt)
        : existing?.syncedAt ?? new Date(0),
      lastAttemptedAt: patch.lastAttemptedAt
        ? new Date(patch.lastAttemptedAt)
        : existing?.lastAttemptedAt ?? new Date(0),
      requestDayKey: patch.requestDayKey ?? existing?.requestDayKey ?? "",
      dailyRequestCount: patch.dailyRequestCount ?? existing?.dailyRequestCount ?? 0,
      blockedUntil: patch.blockedUntil
        ? new Date(patch.blockedUntil)
        : patch.blockedUntil === undefined
          ? existing?.blockedUntil ?? null
          : null
    };

    await this.client.providerState.upsert({
      where: { id: "default" },
      update: updateData,
      create: createData
    });
  }
}
