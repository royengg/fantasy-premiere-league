import type {
  AuthSession,
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
  PredictionAnswer,
  PredictionQuestion,
  PredictionResult,
  Profile,
  Roster,
  Team,
  User,
  UserInventory,
  XPTransaction
} from "@fantasy-cricket/types";

import type { AppStore, AuthCredential } from "../data/store.js";
import { hashPasswordSync } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type { AppRepository } from "./app-repository.js";

const SNAPSHOT_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000
} as const;

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

function mapSessions(rows: Array<{ token: string; userId: string; createdAt: Date; expiresAt: Date }>): AuthSession[] {
  return rows.map((row) => ({
    token: row.token,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString()
  }));
}

function mapCredentials(
  rows: Array<{ userId: string; passwordHash: string; updatedAt: Date }>
): AuthCredential[] {
  return rows.map((row) => ({
    userId: row.userId,
    passwordHash: row.passwordHash,
    updatedAt: row.updatedAt.toISOString()
  }));
}

function mapUsers(rows: Array<{ id: string; email: string; name: string; createdAt: Date }>): User[] {
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
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

function mapPlayers(rows: Array<{ id: string; name: string; teamId: string; role: string; credits: number; rating: number; nationality: string; selectionPercent: number }>): Player[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    teamId: row.teamId,
    role: row.role as Player["role"],
    credits: row.credits,
    rating: row.rating,
    nationality: row.nationality as Player["nationality"],
    selectionPercent: row.selectionPercent
  }));
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

function mapContests(rows: Array<{ id: string; name: string; kind: string; matchId: string; leagueId: string | null; salaryCap: number; rosterRules: Prisma.JsonValue; iplRules: Prisma.JsonValue; lockTime: Date; rewards: Prisma.JsonValue }>): Contest[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as Contest["kind"],
    matchId: row.matchId,
    leagueId: row.leagueId ?? undefined,
    salaryCap: row.salaryCap,
    rosterRules: asJson<Contest["rosterRules"]>(row.rosterRules),
    iplRules: asJson<Contest["iplRules"]>(row.iplRules),
    lockTime: row.lockTime.toISOString(),
    rewards: asJson<Contest["rewards"]>(row.rewards)
  }));
}

function mapLeagues(rows: Array<{ id: string; name: string; description: string | null; visibility: string; createdBy: string; inviteCode: string; memberIds: string[]; contestIds: string[]; bannerStyle: string }>): League[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    visibility: row.visibility as League["visibility"],
    createdBy: row.createdBy,
    inviteCode: row.inviteCode,
    memberIds: row.memberIds,
    contestIds: row.contestIds,
    bannerStyle: row.bannerStyle
  }));
}

function mapRosters(rows: Array<{ id: string; contestId: string; userId: string; players: Prisma.JsonValue; captainPlayerId: string; viceCaptainPlayerId: string; impactPlayerId: string | null; totalCredits: number; submittedAt: Date; locked: boolean; hasUncappedPlayer: boolean }>): Roster[] {
  return rows.map((row) => ({
    id: row.id,
    contestId: row.contestId,
    userId: row.userId,
    players: asJson<Roster["players"]>(row.players),
    captainPlayerId: row.captainPlayerId,
    viceCaptainPlayerId: row.viceCaptainPlayerId,
    impactPlayerId: row.impactPlayerId ?? undefined,
    totalCredits: row.totalCredits,
    submittedAt: row.submittedAt.toISOString(),
    locked: row.locked,
    hasUncappedPlayer: row.hasUncappedPlayer
  }));
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

function mapCosmetics(rows: Array<{ id: string; name: string; description: string; category: string; rarity: string; themeToken: string; gameplayAffecting: boolean; transferable: boolean; redeemable: boolean; resaleValue: boolean }>): CosmeticItem[] {
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
    resaleValue: row.resaleValue as false
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

export class PrismaAppRepository implements AppRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async initialize(seedStore: AppStore): Promise<void> {
    const userCount = await this.client.user.count();
    if (userCount === 0) {
      await this.replaceStore(seedStore);
      return;
    }

    const store = await this.loadStore();
    let changed = false;

    const credentialUserIds = new Set(store.credentials.map((credential) => credential.userId));
    for (const user of store.users) {
      if (credentialUserIds.has(user.id)) {
        continue;
      }

      store.credentials.push({
        userId: user.id,
        passwordHash: hashPasswordSync("password123"),
        updatedAt: new Date().toISOString()
      });
      changed = true;
    }

    for (const profile of store.profiles) {
      if (profile.onboardingCompleted || !profile.username || !profile.favoriteTeamId) {
        continue;
      }

      profile.onboardingCompleted = true;
      changed = true;
    }

    if (changed) {
      await this.replaceStore(store);
    }
  }

  async loadStore(): Promise<AppStore> {
    const [
      sessions,
      credentials,
      users,
      profiles,
      friendships,
      invites,
      teams,
      players,
      matches,
      contests,
      leagues,
      rosters,
      scoreEvents,
      leaderboard,
      questions,
      answers,
      results,
      cosmetics,
      cosmeticUnlocks,
      inventories,
      badges,
      xpTransactions,
      provider
    ] = await Promise.all([
      this.client.session.findMany(),
      this.client.authCredential.findMany(),
      this.client.user.findMany(),
      this.client.profile.findMany(),
      this.client.friendship.findMany(),
      this.client.invite.findMany(),
      this.client.team.findMany(),
      this.client.player.findMany(),
      this.client.match.findMany(),
      this.client.contest.findMany(),
      this.client.league.findMany(),
      this.client.roster.findMany(),
      this.client.fantasyScoreEvent.findMany(),
      this.client.leaderboardEntry.findMany(),
      this.client.predictionQuestion.findMany(),
      this.client.predictionAnswer.findMany(),
      this.client.predictionResult.findMany(),
      this.client.cosmeticItem.findMany(),
      this.client.cosmeticUnlock.findMany(),
      this.client.userInventory.findMany(),
      this.client.badge.findMany(),
      this.client.xPTransaction.findMany(),
      this.client.providerState.findUnique({ where: { id: "default" } })
    ]);

    return {
      sessions: mapSessions(sessions),
      credentials: mapCredentials(credentials),
      users: mapUsers(users),
      profiles: mapProfiles(profiles),
      friendships: mapFriendships(friendships),
      invites: mapInvites(invites),
      teams: mapTeams(teams),
      players: mapPlayers(players),
      matches: mapMatches(matches),
      contests: mapContests(contests),
      leagues: mapLeagues(leagues),
      rosters: mapRosters(rosters),
      scoreEvents: mapScoreEvents(scoreEvents),
      leaderboard: mapLeaderboard(leaderboard),
      questions: mapQuestions(questions),
      answers: mapAnswers(answers),
      results: mapResults(results),
      cosmetics: mapCosmetics(cosmetics),
      cosmeticUnlocks: mapUnlocks(cosmeticUnlocks),
      inventories: mapInventories(inventories),
      badges: mapBadges(badges),
      xpTransactions: mapXpTransactions(xpTransactions),
      provider: provider
        ? {
            status: provider.status as AppStore["provider"]["status"],
            syncedAt: provider.syncedAt.toISOString()
          }
        : {
            status: "idle",
            syncedAt: new Date(0).toISOString()
          }
    };
  }

  async replaceStore(store: AppStore): Promise<void> {
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
            credits: player.credits,
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
            memberIds: league.memberIds,
            contestIds: league.contestIds,
            bannerStyle: league.bannerStyle
          }))
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
            salaryCap: contest.salaryCap,
            rosterRules: inputJson(contest.rosterRules),
            iplRules: inputJson(contest.iplRules),
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
            impactPlayerId: roster.impactPlayerId ?? null,
            totalCredits: roster.totalCredits,
            submittedAt: new Date(roster.submittedAt),
            locked: roster.locked,
            hasUncappedPlayer: roster.hasUncappedPlayer
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
            id: `${result.questionId}-${result.userId}`,
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

      await tx.providerState.create({
        data: {
          id: "default",
          status: store.provider.status,
          syncedAt: new Date(store.provider.syncedAt)
        }
      });
    }, SNAPSHOT_TRANSACTION_OPTIONS);
  }
}
