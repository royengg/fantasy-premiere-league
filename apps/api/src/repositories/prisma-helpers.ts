/**
 * Shared helper functions for Prisma repository implementations.
 *
 * Extracted from PrismaAppRepository to support the auth/game repository split (#3).
 * Contains:
 * - JSON column helpers (asJson, inputJson)
 * - Date conversion helpers
 * - Prisma-row-to-domain-DTO mapping functions
 * - Display-name and leaderboard utilities
 */

import { normalizeIplTeam } from "@fantasy-cricket/domain";
import type {
  Badge,
  Contest,
  CosmeticItem,
  CosmeticUnlock,
  FantasyScoreEvent,
  Friendship,
  Invite,
  LeaderboardEntry,
  League,
  Match,
  Player,
  PlayerMatchStatLine,
  PredictionAnswer,
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
import { calculateRosterPoints } from "@fantasy-cricket/scoring";
import { Prisma } from "../generated/prisma/client.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// JSON column Zod schemas (#16)
//
// These validate data coming out of Prisma JSON columns at runtime,
// replacing the old unsafe `asJson<T>()` casts.
// ---------------------------------------------------------------------------

const cosmeticCategoryEnum = z.enum([
  "profile-theme",
  "avatar-frame",
  "league-banner",
  "card-skin",
  "badge-title"
]);

/** Profile.equippedCosmetics / UserInventory.equipped */
export const equippedCosmeticsSchema = z.object({
  "profile-theme": z.string().optional(),
  "avatar-frame": z.string().optional(),
  "league-banner": z.string().optional(),
  "card-skin": z.string().optional(),
  "badge-title": z.string().optional()
}).default({});

/** Contest.rosterRules */
export const rosterRulesSchema = z.object({
  startingPlayers: z.number(),
  substitutePlayers: z.number(),
  totalPlayers: z.number(),
  minByRole: z.record(z.enum(["WK", "BAT", "AR", "BOWL"]), z.number()),
  maxByRole: z.record(z.enum(["WK", "BAT", "AR", "BOWL"]), z.number()),
  maxPerTeam: z.number()
});

/** Contest.rewards (SeasonReward[]) */
export const seasonRewardsSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["xp", "badge", "cosmetic"]),
  value: z.number(),
  badgeId: z.string().optional(),
  cosmeticId: z.string().optional()
})).default([]);

/** PredictionQuestion.options (PredictionOption[]) */
export const predictionOptionsSchema = z.array(z.object({
  id: z.string(),
  label: z.string(),
  value: z.string()
})).default([]);

/** Roster.players (RosterPlayerSelection[]) */
export const rosterPlayersSchema = z.array(z.object({
  playerId: z.string(),
  isStarter: z.boolean()
})).default([]);

/**
 * Safely parse a Prisma JSON column value against a Zod schema.
 *
 * On validation failure, logs a warning and returns the schema default
 * (or null) instead of crashing. This is intentional — we don't want a
 * single corrupted row to take down the entire API.
 */
export function parseJsonColumn<T>(schema: z.ZodType<T>, value: Prisma.JsonValue | null, context?: string): T {
  const result = schema.safeParse(value ?? undefined);
  if (result.success) {
    return result.data;
  }

  // eslint-disable-next-line no-console
  console.warn(
    `JSON column validation failed${context ? ` (${context})` : ""}: ${result.error.issues.map((i: z.ZodIssue) => i.message).join(", ")}`,
    { value }
  );

  // Try to return the schema's default — if there's no default, return the raw value as-is
  // This is a pragmatic fallback: better to show slightly wrong data than crash
  const defaultResult = schema.safeParse(undefined);
  if (defaultResult.success) {
    return defaultResult.data;
  }

  return value as T;
}

/**
 * @deprecated Use parseJsonColumn with a Zod schema instead.
 * Retained only for the one remaining inputJson usage.
 */
export function asJson<T>(value: Prisma.JsonValue | null): T {
  return (value ?? null) as T;
}

export function inputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function toDate(value: string | undefined | null): Date | null {
  if (!value) {
    return null;
  }

  return new Date(value);
}

export function toDateString(value: Date | null): string | undefined {
  return value?.toISOString();
}

// ---------------------------------------------------------------------------
// Provider budget day key
// ---------------------------------------------------------------------------

export function providerBudgetDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

// ---------------------------------------------------------------------------
// Row → DTO mapping functions
// ---------------------------------------------------------------------------

export function mapUsers(rows: Array<{ id: string; email: string; name: string; isAdmin: boolean; createdAt: Date }>): User[] {
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    isAdmin: row.isAdmin,
    createdAt: row.createdAt.toISOString()
  }));
}

export function mapProfiles(rows: Array<{ userId: string; username: string; bio: string | null; favoriteTeamId: string | null; xp: number; level: number; streak: number; onboardingCompleted: boolean; equippedCosmetics: Prisma.JsonValue }>): Profile[] {
  return rows.map((row) => ({
    userId: row.userId,
    username: row.username,
    bio: row.bio ?? undefined,
    favoriteTeamId: row.favoriteTeamId ?? undefined,
    xp: row.xp,
    level: row.level,
    streak: row.streak,
    onboardingCompleted: row.onboardingCompleted,
    equippedCosmetics: parseJsonColumn(equippedCosmeticsSchema, row.equippedCosmetics, "Profile.equippedCosmetics")
  }));
}

export function mapFriendships(rows: Array<{ id: string; requesterId: string; addresseeId: string; status: string; createdAt: Date }>): Friendship[] {
  return rows.map((row) => ({
    id: row.id,
    requesterId: row.requesterId,
    addresseeId: row.addresseeId,
    status: row.status as Friendship["status"],
    createdAt: row.createdAt.toISOString()
  }));
}

export function mapInvites(rows: Array<{ id: string; leagueId: string; code: string; createdBy: string; createdAt: Date; expiresAt: Date | null }>): Invite[] {
  return rows.map((row) => ({
    id: row.id,
    leagueId: row.leagueId,
    code: row.code,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    expiresAt: toDateString(row.expiresAt)
  }));
}

export function mapTeams(rows: Array<{ id: string; name: string; shortName: string; city: string }>): Team[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    city: row.city
  }));
}

export function mapPlayers(rows: Array<{ id: string; name: string; teamId: string; role: string; rating: number; nationality: string; selectionPercent: number }>): Player[] {
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

export function preferCanonicalTeamsWithPlayers(
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

export function mapMatches(rows: Array<{ id: string; homeTeamId: string; awayTeamId: string; startsAt: Date; venue: string; state: string }>): Match[] {
  return rows.map((row) => ({
    id: row.id,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    startsAt: row.startsAt.toISOString(),
    venue: row.venue,
    state: row.state as Match["state"]
  }));
}

export function mapContests(rows: Array<{ id: string; name: string; kind: string; matchId: string; leagueId: string | null; rosterRules: Prisma.JsonValue; lockTime: Date; rewards: Prisma.JsonValue }>): Contest[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as Contest["kind"],
    matchId: row.matchId,
    leagueId: row.leagueId ?? undefined,
    rosterRules: parseJsonColumn(rosterRulesSchema, row.rosterRules, "Contest.rosterRules"),
    lockTime: row.lockTime.toISOString(),
    rewards: parseJsonColumn(seasonRewardsSchema, row.rewards, "Contest.rewards")
  }));
}

export function mapLeagues(rows: Array<{
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

export function mapRosters(rows: Array<{ id: string; contestId: string; userId: string; players: Prisma.JsonValue; captainPlayerId: string; viceCaptainPlayerId: string; submittedAt: Date; locked: boolean }>): Roster[] {
  return rows.map((row) => toRosterDto(row));
}

export function mapScoreEvents(rows: Array<{ id: string; matchId: string; playerId: string; label: string; points: number; createdAt: Date }>): FantasyScoreEvent[] {
  return rows.map((row) => ({
    id: row.id,
    matchId: row.matchId,
    playerId: row.playerId,
    label: row.label,
    points: row.points,
    createdAt: row.createdAt.toISOString()
  }));
}

export function mapPlayerMatchStatLines(rows: Array<{
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

export function mapLeaderboard(rows: Array<{ id: string; contestId: string; userId: string; points: number; rank: number; previousRank: number; trend: string; projectedPoints: number | null }>): LeaderboardEntry[] {
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

export function withLeaderboardDisplayNames(
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

export function mapQuestions(rows: Array<{ id: string; matchId: string; prompt: string; category: string; options: Prisma.JsonValue; locksAt: Date; resolvesAt: Date; state: string; xpReward: number; badgeRewardId: string | null; cosmeticRewardId: string | null }>): PredictionQuestion[] {
  return rows.map((row) => ({
    id: row.id,
    matchId: row.matchId,
    prompt: row.prompt,
    category: row.category as PredictionQuestion["category"],
    options: parseJsonColumn(predictionOptionsSchema, row.options, "PredictionQuestion.options"),
    locksAt: row.locksAt.toISOString(),
    resolvesAt: row.resolvesAt.toISOString(),
    state: row.state as PredictionQuestion["state"],
    xpReward: row.xpReward,
    badgeRewardId: row.badgeRewardId ?? undefined,
    cosmeticRewardId: row.cosmeticRewardId ?? undefined
  }));
}

export function mapAnswers(rows: Array<{ id: string; questionId: string; userId: string; optionId: string; submittedAt: Date }>): PredictionAnswer[] {
  return rows.map((row) => ({
    id: row.id,
    questionId: row.questionId,
    userId: row.userId,
    optionId: row.optionId,
    submittedAt: row.submittedAt.toISOString()
  }));
}

export function mapResults(rows: Array<{ id: string; questionId: string; userId: string; correctOptionId: string; awardedXp: number; awardedBadgeId: string | null; awardedCosmeticId: string | null; streak: number; settledAt: Date }>): PredictionResult[] {
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

export function mapCosmetics(rows: Array<{ id: string; name: string; description: string; category: string; rarity: string; themeToken: string; gameplayAffecting: boolean; transferable: boolean; redeemable: boolean; resaleValue: number }>): CosmeticItem[] {
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

export function mapUnlocks(rows: Array<{ id: string; userId: string; cosmeticId: string; source: string; unlockedAt: Date }>): CosmeticUnlock[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    cosmeticId: row.cosmeticId,
    source: row.source as CosmeticUnlock["source"],
    unlockedAt: row.unlockedAt.toISOString()
  }));
}

export function mapInventories(rows: Array<{ userId: string; cosmeticIds: string[]; badgeIds: string[]; equipped: Prisma.JsonValue }>): UserInventory[] {
  return rows.map((row) => ({
    userId: row.userId,
    cosmeticIds: row.cosmeticIds,
    badgeIds: row.badgeIds,
    equipped: parseJsonColumn(equippedCosmeticsSchema, row.equipped, "UserInventory.equipped")
  }));
}

export function mapBadges(rows: Array<{ id: string; label: string; description: string; category: string; seasonId: string | null }>): Badge[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    category: row.category as Badge["category"],
    seasonId: row.seasonId ?? undefined
  }));
}

export function mapXpTransactions(rows: Array<{ id: string; userId: string; source: string; amount: number; description: string; createdAt: Date }>): XPTransaction[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    source: row.source as XPTransaction["source"],
    amount: row.amount,
    description: row.description,
    createdAt: row.createdAt.toISOString()
  }));
}

// ---------------------------------------------------------------------------
// Compound helpers
// ---------------------------------------------------------------------------

export function friendshipPairKey(requesterId: string, addresseeId: string) {
  return [requesterId, addresseeId].sort().join(":");
}

export function preferredPublicContests(contests: Contest[]) {
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

export function preferredQuestions(questions: PredictionQuestion[]) {
  const providerQuestions = questions.filter((question) => question.id.startsWith("provider:"));
  return providerQuestions.length > 0
    ? providerQuestions
    : questions.filter((question) => !question.id.startsWith("provider:"));
}

export function normalizeQuestionsForDisplay(
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

export function toLeagueDto(row: {
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

export function toRosterDto(row: {
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
    players: parseJsonColumn(rosterPlayersSchema, row.players, "Roster.players"),
    captainPlayerId: row.captainPlayerId,
    viceCaptainPlayerId: row.viceCaptainPlayerId,
    submittedAt: row.submittedAt.toISOString(),
    locked: row.locked
  };
}

export function buildLeaderboardEntries(
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SNAPSHOT_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 180_000
} as const;

export const DASHBOARD_PUBLIC_CONTEST_LIMIT = 8;
export const DASHBOARD_PRIVATE_CONTEST_LIMIT = 8;
export const DASHBOARD_LEAGUE_LIMIT = 20;
export const DASHBOARD_PREDICTION_LIMIT = 12;
export const DASHBOARD_LEADERBOARD_LIMIT = 25;
export const DEFAULT_LEAGUE_SQUAD_SIZE = 13;
