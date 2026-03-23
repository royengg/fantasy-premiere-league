import { randomUUID } from "node:crypto";

import { createInviteCode } from "@fantasy-cricket/domain";
import {
  canAffordAuctionBid,
  minimumDomesticPlayersNeeded,
  nextAuctionBidAmount
} from "@fantasy-cricket/domain";
import type {
  AuctionBidEntry,
  AuctionCatalogPlayer,
  AuctionEventLogEntry,
  AuctionLot,
  AuctionParticipant,
  AuctionRoomDetails,
  AuctionRoomSettings,
  AuctionRoomSummary,
  AuctionRoster,
  AuctionRosterEntry,
  PlayerNationality,
  TeamRole
} from "@fantasy-cricket/types";
import type {
  CreateAuctionRoomInput,
  JoinAuctionRoomInput,
  UpdateAuctionRoomSettingsInput
} from "@fantasy-cricket/validators";

import { prisma } from "../lib/prisma.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type { AuctionRuntimeRepository } from "./auction-runtime-repository.js";

const DEFAULT_PURSE_LAKHS = 10_000;
const DEFAULT_BASE_PRICE_LAKHS = 25;
const DEFAULT_MAX_OVERSEAS = 6;
const MINIMUM_AUCTION_PARTICIPANTS = 2;
const RECENT_BID_LIMIT = 12;
const EVENT_LOG_LIMIT = 20;
const AUCTION_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
} as const;
const AUCTION_ROOM_LOCK_NAMESPACE = "auction-room";
const AUCTION_TRANSACTION_RETRY_LIMIT = 5;
const AUCTION_TRANSACTION_RETRY_BASE_MS = 40;

type DbClient = PrismaClient | Prisma.TransactionClient;

function buildDisplayName(
  user: { name: string; profile?: { username: string } | null }
) {
  return user.profile?.username || user.name;
}

function isOverseas(nationality: string) {
  return nationality === "overseas";
}

function minimumBidLakhs(basePriceLakhs: number, currentBidLakhs: number | null) {
  return nextAuctionBidAmount(basePriceLakhs, currentBidLakhs ?? undefined);
}

function earliestClosingTime(nowIso: string, seconds: number) {
  return new Date(new Date(nowIso).getTime() + seconds * 1000);
}

function formatBidToken(lakhs: number) {
  if (lakhs >= 100) {
    return `₹${(lakhs / 100).toFixed(lakhs % 100 === 0 ? 0 : 2)}Cr`;
  }

  return `₹${lakhs}L`;
}

function canAffordBid(
  seat: { purseRemainingLakhs: number; slotsRemaining: number },
  amountLakhs: number,
  basePriceLakhs: number
) {
  return canAffordAuctionBid(
    seat.purseRemainingLakhs,
    seat.slotsRemaining,
    amountLakhs,
    basePriceLakhs
  );
}

function normalizedPlayerPoolIds(ids: string[] | undefined) {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
}

function isRetryableAuctionTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PrismaAuctionRepository implements AuctionRuntimeRepository {
  private readonly roomCache = new Map<string, AuctionRoomDetails>();
  private readonly roomTaskQueues = new Map<string, Promise<void>>();

  constructor(private readonly client: PrismaClient = prisma) {}

  private cloneRoom(room: AuctionRoomDetails) {
    return structuredClone(room);
  }

  private cacheRoom(room: AuctionRoomDetails) {
    this.roomCache.set(room.room.id, this.cloneRoom(room));
  }

  private async loadAndCacheRoom(userId: string, roomId: string) {
    const room = await this.loadAuctionRoomDetails(this.client, userId, roomId);
    if (
      room.room.state === "waiting" ||
      room.room.state === "live" ||
      room.room.state === "completed"
    ) {
      this.cacheRoom(room);
    } else {
      this.roomCache.delete(roomId);
    }
    return room;
  }

  private async getCachedOrFreshRoom(userId: string, roomId: string) {
    const cachedRoom = this.roomCache.get(roomId);
    if (cachedRoom && this.canAccessCachedRoom(userId, cachedRoom)) {
      return this.cloneRoom(cachedRoom);
    }

    return this.loadAndCacheRoom(userId, roomId);
  }

  private canAccessCachedRoom(userId: string, room: AuctionRoomDetails) {
    return (
      room.room.visibility === "public" ||
      room.room.hostUserId === userId ||
      room.participants.some((participant) => participant.userId === userId)
    );
  }

  private async runCachedRoomTask<T>(roomId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.roomTaskQueues.get(roomId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => current);
    this.roomTaskQueues.set(roomId, tail);

    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
      if (this.roomTaskQueues.get(roomId) === tail) {
        this.roomTaskQueues.delete(roomId);
      }
    }
  }

  private applyBidToCachedRoom(
    room: AuctionRoomDetails,
    userId: string,
    amountLakhs: number,
    now: string
  ) {
    if (!room.currentLot) {
      return room;
    }

    const participant = room.participants.find((entry) => entry.userId === userId);
    room.currentLot.currentBidLakhs = amountLakhs;
    room.currentLot.currentLeaderUserId = userId;
    room.currentLot.currentLeaderDisplayName =
      participant?.displayName ?? room.currentLot.currentLeaderDisplayName;
    room.room.updatedAt = now;
    room.currentLot.lotEndsAt = new Date(
      Math.max(
        new Date(now).getTime(),
        room.currentLot.lotEndsAt ? new Date(room.currentLot.lotEndsAt).getTime() : 0
      ) + room.settings.bidExtensionSeconds * 1000
    ).toISOString();
    room.skipVoteUserIds = room.skipVoteUserIds.filter((entry) => entry !== userId);
    room.withdrawnUserIds = room.withdrawnUserIds.filter((entry) => entry !== userId);
    room.recentBids = [
      {
        id: randomUUID(),
        roomId: room.room.id,
        poolEntryId: room.currentLot.poolEntryId,
        userId,
        displayName: participant?.displayName ?? "Manager",
        amountLakhs,
        createdAt: now
      },
      ...room.recentBids
    ].slice(0, RECENT_BID_LIMIT);
    room.eventLog = [
      ...room.eventLog,
      {
        id: randomUUID(),
        type: "bid-placed" as const,
        actorUserId: userId,
        message: `${participant?.displayName ?? "A manager"} bid ${formatBidToken(amountLakhs)}.`,
        createdAt: now
      }
    ].slice(-EVENT_LOG_LIMIT);
    return room;
  }

  private applyWithdrawToCachedRoom(room: AuctionRoomDetails, userId: string, now: string) {
    if (room.withdrawnUserIds.includes(userId)) {
      return room;
    }

    const participant = room.participants.find((entry) => entry.userId === userId);
    room.room.updatedAt = now;
    room.skipVoteUserIds = room.skipVoteUserIds.filter((entry) => entry !== userId);
    room.withdrawnUserIds = [...room.withdrawnUserIds, userId];
    room.eventLog = [
      ...room.eventLog,
      {
        id: randomUUID(),
        type: "participant-withdrew" as const,
        actorUserId: userId,
        message: `${participant?.displayName ?? "A manager"} withdrew from the current lot.`,
        createdAt: now
      }
    ].slice(-EVENT_LOG_LIMIT);
    return room;
  }

  private applySkipToCachedRoom(room: AuctionRoomDetails, userId: string, now: string) {
    if (room.skipVoteUserIds.includes(userId)) {
      return room;
    }

    const participant = room.participants.find((entry) => entry.userId === userId);
    room.room.updatedAt = now;
    room.withdrawnUserIds = room.withdrawnUserIds.filter((entry) => entry !== userId);
    room.skipVoteUserIds = [...room.skipVoteUserIds, userId];
    room.eventLog = [
      ...room.eventLog,
      {
        id: randomUUID(),
        type: "skip-voted" as const,
        actorUserId: userId,
        message: `${participant?.displayName ?? "A manager"} voted to skip the current lot.`,
        createdAt: now
      }
    ].slice(-EVENT_LOG_LIMIT);
    return room;
  }

  private eligibleParticipantsForCachedLot(room: AuctionRoomDetails) {
    if (!room.currentLot) {
      return [];
    }

    return this.eligibleParticipantsForLot(
      {
        basePriceLakhs: room.settings.basePriceLakhs,
        currentBidLakhs: room.currentLot.currentBidLakhs ?? null,
        maxOverseas: room.settings.maxOverseas
      },
      room.participants.map((participant) => ({
        userId: participant.userId,
        purseRemainingLakhs: participant.purseRemainingLakhs,
        slotsRemaining: participant.slotsRemaining,
        overseasCount: participant.overseasCount
      })),
      {
        nationality: room.currentLot.nationality
      },
      room.currentLot.currentBidLakhs ?? null
    );
  }

  private roomNeedsAdvanceInCache(room: AuctionRoomDetails, now: string) {
    if (room.room.state !== "live") {
      return false;
    }
    if (!room.currentLot) {
      return true;
    }

    const eligibleParticipants = this.eligibleParticipantsForCachedLot(room);
    const skipVoteSet = new Set(room.skipVoteUserIds);
    const withdrawalSet = new Set(room.withdrawnUserIds);
    const lotExpired =
      room.currentLot.lotEndsAt &&
      new Date(room.currentLot.lotEndsAt).getTime() <= new Date(now).getTime();
    const shouldCloseUnsold =
      !room.currentLot.currentLeaderUserId &&
      (eligibleParticipants.length === 0 ||
        Boolean(lotExpired) ||
        eligibleParticipants.every(
          (participant) =>
            skipVoteSet.has(participant.userId) || withdrawalSet.has(participant.userId)
        ));
    const shouldCloseSold =
      Boolean(room.currentLot.currentLeaderUserId) &&
      (Boolean(lotExpired) ||
        eligibleParticipants
          .filter((participant) => participant.userId !== room.currentLot?.currentLeaderUserId)
          .every((participant) => withdrawalSet.has(participant.userId)));

    return shouldCloseUnsold || shouldCloseSold;
  }

  private async runTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await this.client.$transaction(operation, AUCTION_TRANSACTION_OPTIONS);
      } catch (error) {
        attempt += 1;
        if (!isRetryableAuctionTransactionError(error) || attempt >= AUCTION_TRANSACTION_RETRY_LIMIT) {
          throw error;
        }
        await delay(AUCTION_TRANSACTION_RETRY_BASE_MS * attempt);
      }
    }
  }

  private async runRoomTransaction<T>(
    roomId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.runTransaction(async (tx) => {
      await this.acquireAuctionRoomLock(tx, roomId);
      return operation(tx);
    });
  }

  private async acquireAuctionRoomLock(tx: Prisma.TransactionClient, roomId: string) {
    await tx.$queryRaw<Array<{ locked: number }>>`
      WITH room_lock AS (
        SELECT pg_advisory_xact_lock(
          hashtext(${AUCTION_ROOM_LOCK_NAMESPACE}),
          hashtext(${roomId})
        )
      )
      SELECT 1::int AS locked
      FROM room_lock
    `;
  }

  async listAuctionRoomsForUser(userId: string): Promise<AuctionRoomSummary[]> {
    const rooms = await this.client.auctionRoom.findMany({
      where: {
        OR: [
          { participants: { some: { userId } } },
          { league: { members: { some: { userId } } } },
          { visibility: "public", state: "waiting" }
        ]
      },
      include: {
        host: {
          include: {
            profile: true
          }
        },
        league: {
          include: {
            members: {
              select: { userId: true }
            }
          }
        },
        participants: {
          select: {
            userId: true
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 30
    });

    const summaries: AuctionRoomSummary[] = rooms.map((room) => ({
      id: room.id,
      leagueId: room.league?.id ?? undefined,
      leagueName: room.league?.name ?? undefined,
      name: room.name,
      visibility: room.visibility as AuctionRoomSummary["visibility"],
      state: room.state as AuctionRoomSummary["state"],
      hostUserId: room.hostUserId,
      hostDisplayName: buildDisplayName(room.host),
      inviteCode:
        room.visibility === "private" && room.participants.some((seat) => seat.userId === userId)
          ? room.inviteCode ?? undefined
          : undefined,
      participantCount: room.participants.length,
      maxParticipants: room.maxParticipants,
      squadSize: room.squadSize,
      bidWindowSeconds: room.bidWindowSeconds,
      playerPoolMode: room.playerPoolMode as AuctionRoomSummary["playerPoolMode"],
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      startedAt: room.startedAt?.toISOString(),
      completedAt: room.completedAt?.toISOString()
    }));

    for (const cachedRoom of this.roomCache.values()) {
      if (!this.canAccessCachedRoom(userId, cachedRoom)) {
        continue;
      }

      const existingIndex = summaries.findIndex((entry) => entry.id === cachedRoom.room.id);
      if (existingIndex >= 0) {
        summaries[existingIndex] = this.cloneRoom(cachedRoom).room;
      } else {
        summaries.unshift(this.cloneRoom(cachedRoom).room);
      }
    }

    return summaries;
  }

  async getAuctionCatalogPlayers(): Promise<AuctionCatalogPlayer[]> {
    const players = await this.client.player.findMany({
      include: {
        team: true
      },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      take: 500
    });

    return players.map((player) => ({
      playerId: player.id,
      name: player.name,
      teamId: player.teamId,
      teamName: player.team.name,
      teamShortName: player.team.shortName,
      role: player.role as TeamRole,
      nationality: player.nationality as PlayerNationality,
      rating: player.rating
    }));
  }

  async getAuctionRoomDetails(userId: string, roomId: string): Promise<AuctionRoomDetails> {
    return this.getCachedOrFreshRoom(userId, roomId);
  }

  async createAuctionRoomRecord(
    userId: string,
    input: CreateAuctionRoomInput
  ): Promise<AuctionRoomDetails> {
    const roomId = randomUUID();

    await this.runTransaction(async (tx) => {
      let leagueVisibility: "public" | "private" = input.visibility;
      let maxParticipants = input.maxParticipants;
      let squadSize = input.squadSize;

      if (input.leagueId) {
        const league = await tx.league.findUnique({
          where: { id: input.leagueId },
          include: {
            members: {
              select: { userId: true }
            },
            auctionRooms: {
              select: { id: true }
            }
          }
        });

        if (!league) {
          throw new Error("League not found.");
        }
        if (!league.members.some((member) => member.userId === userId)) {
          throw new Error("Join the league before hosting its auction.");
        }
        if (league.createdBy !== userId) {
          throw new Error("Only the league host can create the league auction.");
        }
        if (league.auctionRooms.length > 0) {
          throw new Error("This league already has an auction room.");
        }
        if (input.squadSize !== league.squadSize) {
          throw new Error(`League auctions must use ${league.squadSize}-player squads.`);
        }

        leagueVisibility = league.visibility as "public" | "private";
        maxParticipants = Math.min(input.maxParticipants, league.maxMembers);
        squadSize = league.squadSize;
      }

      const effectiveInviteCode = leagueVisibility === "private" ? createInviteCode(input.name) : null;
      const poolPlayers = await this.resolvePoolPlayers(tx, input);
      const poolPlayerIds = poolPlayers.map((player) => player.id);
      if (poolPlayerIds.length < MINIMUM_AUCTION_PARTICIPANTS * squadSize) {
        throw new Error("Player pool is too small to open an auction room.");
      }
      if (
        poolPlayers.filter((player) => !isOverseas(player.nationality)).length <
        minimumDomesticPlayersNeeded(
          MINIMUM_AUCTION_PARTICIPANTS,
          squadSize,
          DEFAULT_MAX_OVERSEAS
        )
      ) {
        throw new Error("The selected player pool does not have enough domestic players.");
      }

      await tx.auctionRoom.create({
        data: {
          id: roomId,
          leagueId: input.leagueId,
          name: input.name,
          visibility: leagueVisibility,
          hostUserId: userId,
          state: "waiting",
          inviteCode: effectiveInviteCode,
          maxParticipants,
          squadSize,
          purseLakhs: DEFAULT_PURSE_LAKHS,
          basePriceLakhs: DEFAULT_BASE_PRICE_LAKHS,
          bidWindowSeconds: input.bidWindowSeconds,
          bidExtensionSeconds: input.bidExtensionSeconds,
          maxOverseas: DEFAULT_MAX_OVERSEAS,
          playerPoolMode: input.playerPoolMode
        }
      });

      await tx.auctionParticipant.create({
        data: {
          roomId,
          userId,
          ready: false,
          purseRemainingLakhs: DEFAULT_PURSE_LAKHS,
          slotsRemaining: squadSize,
          overseasCount: 0
        }
      });

      await tx.auctionPoolEntry.createMany({
        data: poolPlayerIds.map((playerId, index) => ({
          id: `${roomId}:${playerId}`,
          roomId,
          playerId,
          nominationOrder: index + 1,
          state: "pending"
        }))
      });

      await this.logEvent(tx, roomId, "room-created", userId, `Auction room ${input.name} created.`);
    });

    return this.loadAndCacheRoom(userId, roomId);
  }

  async updateAuctionRoomSettingsRecord(
    userId: string,
    roomId: string,
    input: UpdateAuctionRoomSettingsInput
  ): Promise<AuctionRoomDetails> {
    await this.runRoomTransaction(roomId, async (tx) => {
      const room = await tx.auctionRoom.findUnique({
        where: { id: roomId },
        include: {
          league: {
            select: {
              id: true,
              maxMembers: true,
              squadSize: true
            }
          },
          participants: true
        }
      });
      if (!room) {
        throw new Error("Auction room not found.");
      }
      if (room.hostUserId !== userId) {
        throw new Error("Only the room host can update auction settings.");
      }
      if (room.state !== "waiting") {
        throw new Error("Auction settings can only be changed before the room starts.");
      }
      if (room.league && input.squadSize !== room.league.squadSize) {
        throw new Error(`League auctions must keep ${room.league.squadSize}-player squads.`);
      }
      if (room.participants.length > input.maxParticipants) {
        throw new Error("Max participants cannot be lower than the current room size.");
      }
      if (room.league && input.maxParticipants > room.league.maxMembers) {
        throw new Error(`League auctions cannot exceed ${room.league.maxMembers} participants.`);
      }

      const poolPlayers = await this.resolvePoolPlayers(tx, input);
      const poolPlayerIds = poolPlayers.map((player) => player.id);
      if (poolPlayerIds.length < MINIMUM_AUCTION_PARTICIPANTS * input.squadSize) {
        throw new Error("Player pool is too small to keep this auction room open.");
      }
      if (
        poolPlayers.filter((player) => !isOverseas(player.nationality)).length <
        minimumDomesticPlayersNeeded(
          MINIMUM_AUCTION_PARTICIPANTS,
          input.squadSize,
          room.maxOverseas
        )
      ) {
        throw new Error("The selected player pool does not have enough domestic players.");
      }

      await tx.auctionPoolEntry.deleteMany({
        where: { roomId }
      });

      await tx.auctionRoom.update({
        where: { id: roomId },
        data: {
          name: input.name,
          maxParticipants: input.maxParticipants,
          squadSize: input.squadSize,
          bidWindowSeconds: input.bidWindowSeconds,
          bidExtensionSeconds: input.bidExtensionSeconds,
          playerPoolMode: input.playerPoolMode,
          currentPoolEntryId: null,
          currentBidLakhs: null,
          currentLeaderUserId: null,
          lotOpenedAt: null,
          lotEndsAt: null
        }
      });

      await tx.auctionParticipant.updateMany({
        where: { roomId },
        data: {
          ready: false,
          purseRemainingLakhs: DEFAULT_PURSE_LAKHS,
          slotsRemaining: input.squadSize,
          overseasCount: 0
        }
      });

      await tx.auctionPoolEntry.createMany({
        data: poolPlayerIds.map((playerId, index) => ({
          id: `${roomId}:${playerId}`,
          roomId,
          playerId,
          nominationOrder: index + 1,
          state: "pending"
        }))
      });

      await this.logEvent(tx, roomId, "settings-updated", userId, "Auction settings updated.");
    });

    return this.loadAndCacheRoom(userId, roomId);
  }

  async joinAuctionRoomRecord(userId: string, input: JoinAuctionRoomInput): Promise<AuctionRoomDetails> {
    const roomId = await this.runTransaction(async (tx) => {
      const initialRoom = input.roomId
        ? await tx.auctionRoom.findUnique({
            where: { id: input.roomId },
            include: {
              league: {
                include: {
                  members: {
                    select: { userId: true }
                  }
                }
              },
              participants: true,
              poolEntries: {
                include: {
                  player: {
                    select: {
                      nationality: true
                    }
                  }
                }
              }
            }
          })
        : await tx.auctionRoom.findFirst({
            where: { inviteCode: input.inviteCode ?? undefined },
            include: {
              league: {
                include: {
                  members: {
                    select: { userId: true }
                  }
                }
              },
              participants: true,
              poolEntries: {
                include: {
                  player: {
                    select: {
                      nationality: true
                    }
                  }
                }
              }
            }
          });

      if (!initialRoom) {
        throw new Error("Auction room not found.");
      }
      await this.acquireAuctionRoomLock(tx, initialRoom.id);
      const room = await tx.auctionRoom.findUnique({
        where: { id: initialRoom.id },
        include: {
          league: {
            include: {
              members: {
                select: { userId: true }
              }
            }
          },
          participants: true,
          poolEntries: {
            include: {
              player: {
                select: {
                  nationality: true
                }
              }
            }
          }
        }
      });

      if (!room) {
        throw new Error("Auction room not found.");
      }
      if (room.state !== "waiting") {
        throw new Error("You can only join an auction before it starts.");
      }
      const isLeagueMember = room.league?.members.some((member) => member.userId === userId) ?? false;
      if (room.leagueId && !isLeagueMember && room.visibility !== "public") {
        throw new Error("Join the league before entering its auction.");
      }
      if (room.leagueId && !isLeagueMember && room.visibility === "public") {
        if ((room.league?.members.length ?? 0) >= room.maxParticipants) {
          throw new Error("This public league is already full.");
        }

        await tx.leagueMember.upsert({
          where: {
            leagueId_userId: {
              leagueId: room.leagueId,
              userId
            }
          },
          update: {},
          create: {
            leagueId: room.leagueId,
            userId
          }
        });
      }
      if (room.visibility === "private" && !room.leagueId && !input.inviteCode && room.hostUserId !== userId) {
        throw new Error("Private auction rooms require an invite code.");
      }
      if (room.participants.some((participant) => participant.userId === userId)) {
        return room.id;
      }
      if (room.participants.length >= room.maxParticipants) {
        throw new Error("This auction room is already full.");
      }
      if (room.poolEntries.length < (room.participants.length + 1) * room.squadSize) {
        throw new Error("This auction room does not have enough players left for another participant.");
      }
      if (
        room.poolEntries.filter((entry) => !isOverseas(entry.player.nationality)).length <
        minimumDomesticPlayersNeeded(room.participants.length + 1, room.squadSize, room.maxOverseas)
      ) {
        throw new Error("This auction room does not have enough domestic players for another participant.");
      }

      await tx.auctionParticipant.create({
        data: {
          roomId: room.id,
          userId,
          ready: false,
          purseRemainingLakhs: room.purseLakhs,
          slotsRemaining: room.squadSize,
          overseasCount: 0
        }
      });

      await this.logEvent(tx, room.id, "participant-joined", userId, "A participant joined the room.");
      return room.id;
    });

    return this.loadAndCacheRoom(userId, roomId);
  }

  async setAuctionReadyRecord(
    userId: string,
    roomId: string,
    ready: boolean
  ): Promise<AuctionRoomDetails> {
    await this.runRoomTransaction(roomId, async (tx) => {
      const now = new Date().toISOString();
      const room = await tx.auctionRoom.findUnique({
        where: { id: roomId }
      });
      if (!room) {
        throw new Error("Auction room not found.");
      }
      if (room.state !== "waiting") {
        throw new Error("Ready state can only be changed before the auction starts.");
      }

      const seat = await tx.auctionParticipant.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId
          }
        }
      });
      if (!seat) {
        throw new Error("You are not a participant in this auction room.");
      }

      await tx.auctionParticipant.update({
        where: {
          roomId_userId: {
            roomId,
            userId
          }
        },
        data: { ready }
      });

      await this.logEvent(
        tx,
        roomId,
        "participant-ready",
        userId,
        ready ? "A participant is ready." : "A participant is no longer ready."
      );

      const updatedRoom = await tx.auctionRoom.findUnique({
        where: { id: roomId },
        include: {
          participants: true,
          poolEntries: {
            include: {
              player: {
                select: {
                  nationality: true
                }
              }
            }
          }
        }
      });

      if (!updatedRoom || updatedRoom.state !== "waiting") {
        return;
      }

      if (updatedRoom.participants.length < 2) {
        return;
      }

      if (!updatedRoom.participants.every((participant) => participant.ready)) {
        return;
      }

      if (updatedRoom.poolEntries.length < updatedRoom.participants.length * updatedRoom.squadSize) {
        throw new Error("Player pool is too small for the joined managers in this league.");
      }

      const domesticPlayerCount = updatedRoom.poolEntries.filter(
        (entry) => !isOverseas(entry.player.nationality)
      ).length;
      const requiredDomesticCount = minimumDomesticPlayersNeeded(
        updatedRoom.participants.length,
        updatedRoom.squadSize,
        updatedRoom.maxOverseas
      );
      if (domesticPlayerCount < requiredDomesticCount) {
        throw new Error("The selected player pool does not have enough domestic players.");
      }

      await tx.auctionRoom.update({
        where: { id: roomId },
        data: {
          state: "live",
          startedAt: new Date(now),
          currentPoolEntryId: null,
          currentBidLakhs: null,
          currentLeaderUserId: null,
          lotOpenedAt: null,
          lotEndsAt: null
        }
      });

      await tx.auctionParticipant.updateMany({
        where: { roomId },
        data: { ready: false }
      });

      await this.logEvent(
        tx,
        roomId,
        "auction-started",
        null,
        "All joined managers are ready. Auction started automatically."
      );
      await this.advanceAuctionRoomLocked(tx, roomId, now);
    });

    return this.loadAndCacheRoom(userId, roomId);
  }

  async startAuctionRoomRecord(
    userId: string,
    roomId: string,
    now: string
  ): Promise<AuctionRoomDetails> {
    await this.runRoomTransaction(roomId, async (tx) => {
      const room = await tx.auctionRoom.findUnique({
        where: { id: roomId },
        include: {
          participants: true,
          poolEntries: {
            include: {
              player: true
            }
          }
        }
      });
      if (!room) {
        throw new Error("Auction room not found.");
      }
      if (room.hostUserId !== userId) {
        throw new Error("Only the room host can start the auction.");
      }
      if (room.state !== "waiting") {
        throw new Error("Auction has already started.");
      }
      if (room.participants.length < 2) {
        throw new Error("At least 2 participants are required to start an auction.");
      }
      if (!room.participants.every((participant) => participant.ready)) {
        throw new Error("All participants must be ready before the auction can start.");
      }
      if (room.poolEntries.length < room.participants.length * room.squadSize) {
        throw new Error("Player pool is too small for the current room size.");
      }

      const domesticPlayerCount = room.poolEntries.filter(
        (entry) => !isOverseas(entry.player.nationality)
      ).length;
      const requiredDomesticCount = minimumDomesticPlayersNeeded(
        room.participants.length,
        room.squadSize,
        room.maxOverseas
      );
      if (domesticPlayerCount < requiredDomesticCount) {
        throw new Error("The selected player pool does not have enough domestic players.");
      }

      await tx.auctionRoom.update({
        where: { id: roomId },
        data: {
          state: "live",
          startedAt: new Date(now),
          currentPoolEntryId: null,
          currentBidLakhs: null,
          currentLeaderUserId: null,
          lotOpenedAt: null,
          lotEndsAt: null
        }
      });

      await tx.auctionParticipant.updateMany({
        where: { roomId },
        data: { ready: false }
      });

      await this.logEvent(tx, roomId, "auction-started", userId, "Auction started.");
      await this.advanceAuctionRoomLocked(tx, roomId, now);
    });

    return this.loadAndCacheRoom(userId, roomId);
  }

  async placeAuctionBidRecord(
    userId: string,
    roomId: string,
    expectedPoolEntryId: string,
    amountLakhs: number,
    now: string
  ): Promise<AuctionRoomDetails> {
    return this.runCachedRoomTask(roomId, async () => {
      let room = await this.getCachedOrFreshRoom(userId, roomId);
      if (this.roomNeedsAdvanceInCache(room, now)) {
        const changed = await this.advanceAuctionRoom(roomId, now);
        if (changed) {
          room = await this.loadAndCacheRoom(userId, roomId);
        }
      }

      if (room.room.state !== "live") {
        throw new Error("Auction is not live.");
      }
      if (!room.currentLot) {
        throw new Error("No player is currently up for bidding.");
      }
      if (room.currentLot.poolEntryId !== expectedPoolEntryId) {
        throw new Error("That player is no longer the active lot.");
      }

      const seat = room.participants.find((participant) => participant.userId === userId);
      if (!seat) {
        throw new Error("You are not part of this auction room.");
      }
      if (seat.slotsRemaining <= 0) {
        throw new Error("Your auction squad is already full.");
      }
      if (room.currentLot.currentLeaderUserId === userId) {
        throw new Error("You already have the highest bid.");
      }
      if (
        isOverseas(room.currentLot.nationality) &&
        seat.overseasCount >= room.settings.maxOverseas
      ) {
        throw new Error("You have already reached the overseas player limit.");
      }

      const minBid = minimumBidLakhs(
        room.settings.basePriceLakhs,
        room.currentLot.currentBidLakhs ?? null
      );
      if (amountLakhs < minBid) {
        throw new Error(`Minimum valid bid is ₹${(minBid / 100).toFixed(2)} crore.`);
      }
      if (!canAffordBid(seat, amountLakhs, room.settings.basePriceLakhs)) {
        throw new Error("That bid would leave you without enough purse to complete your squad.");
      }

      await this.runRoomTransaction(roomId, async (tx) => {
        await tx.auctionSkipVote.deleteMany({
          where: {
            poolEntryId: room.currentLot!.poolEntryId,
            userId
          }
        });
        await tx.auctionWithdrawal.deleteMany({
          where: {
            poolEntryId: room.currentLot!.poolEntryId,
            userId
          }
        });

        await tx.auctionBid.create({
          data: {
            id: randomUUID(),
            roomId,
            poolEntryId: room.currentLot!.poolEntryId,
            userId,
            amountLakhs
          }
        });

        const extendedFrom = Math.max(
          new Date(now).getTime(),
          room.currentLot?.lotEndsAt ? new Date(room.currentLot.lotEndsAt).getTime() : new Date(now).getTime()
        );

        await tx.auctionRoom.update({
          where: { id: roomId },
          data: {
            currentBidLakhs: amountLakhs,
            currentLeaderUserId: userId,
            lotEndsAt: new Date(extendedFrom + room.settings.bidExtensionSeconds * 1000)
          }
        });

        await this.logEvent(
          tx,
          roomId,
          "bid-placed",
          userId,
          `Bid placed for ${room.currentLot!.playerName}.`,
          {
            poolEntryId: room.currentLot!.poolEntryId,
            amountLakhs
          }
        );
      });

      room = this.applyBidToCachedRoom(room, userId, amountLakhs, now);
      this.cacheRoom(room);
      return this.cloneRoom(room);
    });
  }

  async withdrawFromAuctionLotRecord(
    userId: string,
    roomId: string,
    expectedPoolEntryId: string,
    now: string
  ): Promise<AuctionRoomDetails> {
    return this.runCachedRoomTask(roomId, async () => {
      let room = await this.getCachedOrFreshRoom(userId, roomId);
      if (this.roomNeedsAdvanceInCache(room, now)) {
        const changed = await this.advanceAuctionRoom(roomId, now);
        if (changed) {
          room = await this.loadAndCacheRoom(userId, roomId);
        }
      }

      if (room.room.state !== "live" || !room.currentLot) {
        throw new Error("There is no active auction lot to withdraw from.");
      }
      if (room.currentLot.poolEntryId !== expectedPoolEntryId) {
        throw new Error("That player is no longer the active lot.");
      }
      if (!room.participants.some((participant) => participant.userId === userId)) {
        throw new Error("You are not part of this auction room.");
      }
      if (room.currentLot.currentLeaderUserId === userId) {
        throw new Error("The current highest bidder cannot withdraw.");
      }

      await this.runRoomTransaction(roomId, async (tx) => {
        await tx.auctionSkipVote.deleteMany({
          where: {
            poolEntryId: room.currentLot!.poolEntryId,
            userId
          }
        });

        const existing = await tx.auctionWithdrawal.findUnique({
          where: {
            poolEntryId_userId: {
              poolEntryId: room.currentLot!.poolEntryId,
              userId
            }
          }
        });

        if (!existing) {
          await tx.auctionWithdrawal.create({
            data: {
              roomId,
              poolEntryId: room.currentLot!.poolEntryId,
              userId
            }
          });

          await this.logEvent(
            tx,
            roomId,
            "participant-withdrew",
            userId,
            "A participant withdrew from the current bidding round.",
            {
              poolEntryId: room.currentLot!.poolEntryId
            }
          );
        }
      });

      room = this.applyWithdrawToCachedRoom(room, userId, now);
      if (this.roomNeedsAdvanceInCache(room, now)) {
        const changed = await this.advanceAuctionRoom(roomId, now);
        if (changed) {
          room = await this.loadAndCacheRoom(userId, roomId);
          return this.cloneRoom(room);
        }
      }

      this.cacheRoom(room);
      return this.cloneRoom(room);
    });
  }

  async voteSkipAuctionLotRecord(
    userId: string,
    roomId: string,
    expectedPoolEntryId: string,
    now: string
  ): Promise<AuctionRoomDetails> {
    return this.runCachedRoomTask(roomId, async () => {
      let room = await this.getCachedOrFreshRoom(userId, roomId);
      if (this.roomNeedsAdvanceInCache(room, now)) {
        const changed = await this.advanceAuctionRoom(roomId, now);
        if (changed) {
          room = await this.loadAndCacheRoom(userId, roomId);
        }
      }

      if (room.room.state !== "live" || !room.currentLot) {
        throw new Error("There is no active auction lot to skip.");
      }
      if (room.currentLot.poolEntryId !== expectedPoolEntryId) {
        throw new Error("That player is no longer the active lot.");
      }
      if (!room.participants.some((participant) => participant.userId === userId)) {
        throw new Error("You are not part of this auction room.");
      }
      if (room.currentLot.currentBidLakhs || room.currentLot.currentLeaderUserId) {
        throw new Error("Skip voting closes as soon as bidding starts.");
      }

      await this.runRoomTransaction(roomId, async (tx) => {
        await tx.auctionWithdrawal.deleteMany({
          where: {
            poolEntryId: room.currentLot!.poolEntryId,
            userId
          }
        });

        const existing = await tx.auctionSkipVote.findUnique({
          where: {
            poolEntryId_userId: {
              poolEntryId: room.currentLot!.poolEntryId,
              userId
            }
          }
        });

        if (!existing) {
          await tx.auctionSkipVote.create({
            data: {
              roomId,
              poolEntryId: room.currentLot!.poolEntryId,
              userId
            }
          });

          await this.logEvent(
            tx,
            roomId,
            "skip-voted",
            userId,
            "A participant voted to skip the current player.",
            {
              poolEntryId: room.currentLot!.poolEntryId
            }
          );
        }
      });

      room = this.applySkipToCachedRoom(room, userId, now);
      if (this.roomNeedsAdvanceInCache(room, now)) {
        const changed = await this.advanceAuctionRoom(roomId, now);
        if (changed) {
          room = await this.loadAndCacheRoom(userId, roomId);
          return this.cloneRoom(room);
        }
      }

      this.cacheRoom(room);
      return this.cloneRoom(room);
    });
  }

  async advanceDueAuctionRooms(now: string): Promise<string[]> {
    const changedRoomIds: string[] = [];
    const candidateRoomIds = new Set<string>();

    for (const room of this.roomCache.values()) {
      if (room.room.state === "live" && this.roomNeedsAdvanceInCache(room, now)) {
        candidateRoomIds.add(room.room.id);
      }
    }

    if (candidateRoomIds.size === 0) {
      const liveRooms = await this.client.auctionRoom.findMany({
        where: {
          state: "live",
          OR: [{ currentPoolEntryId: null }, { lotEndsAt: { lte: new Date(now) } }]
        },
        select: {
          id: true
        }
      });
      for (const room of liveRooms) {
        candidateRoomIds.add(room.id);
      }
    }

    for (const roomId of candidateRoomIds) {
      const changed = await this.runCachedRoomTask(roomId, async () => {
        const advanced = await this.advanceAuctionRoom(roomId, now);
        if (!advanced) {
          return false;
        }

        const userId =
          this.roomCache.get(roomId)?.participants[0]?.userId ??
          (await this.getAuctionParticipantIds(roomId))[0];
        if (!userId) {
          this.roomCache.delete(roomId);
          return false;
        }

        await this.loadAndCacheRoom(userId, roomId);
        return true;
      });
      if (changed) {
        changedRoomIds.push(roomId);
      }
    }

    return changedRoomIds;
  }

  async getAuctionParticipantIds(roomId: string): Promise<string[]> {
    const cachedRoom = this.roomCache.get(roomId);
    if (cachedRoom) {
      return cachedRoom.participants.map((participant) => participant.userId);
    }

    const rows = await this.client.auctionParticipant.findMany({
      where: { roomId },
      select: { userId: true }
    });
    return rows.map((row) => row.userId);
  }

  private async resolvePoolPlayers(
    tx: DbClient,
    input: Pick<CreateAuctionRoomInput, "playerPoolMode" | "playerPoolPlayerIds">
  ) {
    if (input.playerPoolMode === "custom") {
      const playerIds = normalizedPlayerPoolIds(input.playerPoolPlayerIds);
      const rows = await tx.player.findMany({
        where: {
          id: {
            in: playerIds
          }
        },
        select: {
          id: true,
          nationality: true
        }
      });
      if (rows.length !== playerIds.length) {
        throw new Error("Some selected auction players were not found.");
      }
      return playerIds.map((playerId) => {
        const player = rows.find((row) => row.id === playerId);
        if (!player) {
          throw new Error("Some selected auction players were not found.");
        }
        return player;
      });
    }

    const rows = await tx.player.findMany({
      select: {
        id: true,
        nationality: true
      },
      orderBy: [{ rating: "desc" }, { name: "asc" }]
    });

    if (rows.length === 0) {
      throw new Error("No players are available to seed the auction pool.");
    }

    return rows;
  }

  private async loadAuctionRoomDetails(
    tx: DbClient,
    userId: string,
    roomId: string
  ): Promise<AuctionRoomDetails> {
    const room = await tx.auctionRoom.findUnique({
      where: { id: roomId },
      include: {
        league: {
          include: {
            members: {
              select: { userId: true }
            }
          }
        },
        host: {
          include: {
            profile: true
          }
        },
        participants: {
          include: {
            user: {
              include: {
                profile: true
              }
            }
          },
          orderBy: [{ joinedAt: "asc" }]
        }
      }
    });

    if (!room) {
      throw new Error("Auction room not found.");
    }

    const isParticipant = room.participants.some((participant) => participant.userId === userId);
    const isLeagueMember = room.league?.members.some((member) => member.userId === userId) ?? false;
    if (room.visibility === "private" && !isParticipant && room.hostUserId !== userId && !isLeagueMember) {
      throw new Error("This auction room is private.");
    }

    const [
      recentBids,
      eventRows,
      currentEntry,
      soldEntries,
      selectedPlayerRows,
      pendingPlayerCount,
      totalPoolCount
    ] = await Promise.all([
      tx.auctionBid.findMany({
        where: { roomId },
        include: {
          user: {
            include: {
              profile: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }],
        take: RECENT_BID_LIMIT
      }),
      tx.auctionEventLog.findMany({
        where: { roomId },
        orderBy: [{ createdAt: "desc" }],
        take: EVENT_LOG_LIMIT
      }),
      room.currentPoolEntryId
        ? tx.auctionPoolEntry.findUnique({
            where: { id: room.currentPoolEntryId },
            include: {
              player: {
                include: {
                  team: true
                }
              },
              soldTo: {
                include: {
                  profile: true
                }
              }
            }
          })
        : Promise.resolve(null),
      tx.auctionPoolEntry.findMany({
        where: {
          roomId,
          state: "sold",
          soldToUserId: {
            not: null
          }
        },
        include: {
          player: {
            include: {
              team: true
            }
          }
        },
        orderBy: [{ nominationOrder: "asc" }]
      }),
      tx.auctionPoolEntry.findMany({
        where: { roomId },
        select: { playerId: true },
        orderBy: [{ nominationOrder: "asc" }]
      }),
      tx.auctionPoolEntry.count({
        where: {
          roomId,
          state: "pending"
        }
      }),
      tx.auctionPoolEntry.count({
        where: { roomId }
      })
    ]);

    const currentLot = currentEntry
      ? this.toAuctionLot(
          currentEntry,
          room.basePriceLakhs,
          room.currentBidLakhs,
          room.currentLeaderUserId,
          room.lotEndsAt
        )
      : undefined;

    const currentLotSkipVotes = currentEntry
      ? await tx.auctionSkipVote.findMany({
          where: { poolEntryId: currentEntry.id },
          select: { userId: true }
        })
      : [];
    const currentLotWithdrawals = currentEntry
      ? await tx.auctionWithdrawal.findMany({
          where: { poolEntryId: currentEntry.id },
          select: { userId: true }
        })
      : [];

    const participantDisplayNames = new Map(
      room.participants.map((participant) => [
        participant.userId,
        buildDisplayName(participant.user)
      ])
    );

    if (currentLot?.currentLeaderUserId) {
      currentLot.currentLeaderDisplayName = participantDisplayNames.get(currentLot.currentLeaderUserId);
    }
    if (currentLot?.soldToUserId) {
      currentLot.soldToDisplayName = participantDisplayNames.get(currentLot.soldToUserId);
    }

    const rosterMap = new Map<string, AuctionRoster>();
    for (const participant of room.participants) {
      rosterMap.set(participant.userId, {
        userId: participant.userId,
        displayName: participantDisplayNames.get(participant.userId) ?? participant.user.name,
        players: [],
        totalSpentLakhs: room.purseLakhs - participant.purseRemainingLakhs,
        purseRemainingLakhs: participant.purseRemainingLakhs,
        slotsRemaining: participant.slotsRemaining
      });
    }
    for (const entry of soldEntries) {
      const roster = entry.soldToUserId ? rosterMap.get(entry.soldToUserId) : undefined;
      if (!roster || !entry.soldPriceLakhs) {
        continue;
      }
      roster.players.push({
        playerId: entry.playerId,
        playerName: entry.player.name,
        teamId: entry.player.teamId,
        teamName: entry.player.team.name,
        teamShortName: entry.player.team.shortName,
        role: entry.player.role as TeamRole,
        nationality: entry.player.nationality as PlayerNationality,
        priceLakhs: entry.soldPriceLakhs
      });
    }
    for (const roster of rosterMap.values()) {
      roster.players.sort((left, right) => left.playerName.localeCompare(right.playerName));
    }

    return {
      room: {
        id: room.id,
        leagueId: room.league?.id ?? undefined,
        leagueName: room.league?.name ?? undefined,
        name: room.name,
        visibility: room.visibility as AuctionRoomSummary["visibility"],
        state: room.state as AuctionRoomSummary["state"],
        hostUserId: room.hostUserId,
        hostDisplayName: buildDisplayName(room.host),
        inviteCode: isParticipant || room.hostUserId === userId ? room.inviteCode ?? undefined : undefined,
        participantCount: room.participants.length,
        maxParticipants: room.maxParticipants,
        squadSize: room.squadSize,
        bidWindowSeconds: room.bidWindowSeconds,
        playerPoolMode: room.playerPoolMode as AuctionRoomSummary["playerPoolMode"],
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
        startedAt: room.startedAt?.toISOString(),
        completedAt: room.completedAt?.toISOString()
      },
      settings: {
        leagueId: room.league?.id ?? undefined,
        maxParticipants: room.maxParticipants,
        squadSize: room.squadSize,
        purseLakhs: room.purseLakhs,
        basePriceLakhs: room.basePriceLakhs,
        bidWindowSeconds: room.bidWindowSeconds,
        bidExtensionSeconds: room.bidExtensionSeconds,
        maxOverseas: room.maxOverseas,
        playerPoolMode: room.playerPoolMode as AuctionRoomSettings["playerPoolMode"]
      },
      participants: room.participants.map((participant) => ({
        userId: participant.userId,
        displayName: participantDisplayNames.get(participant.userId) ?? participant.user.name,
        isHost: participant.userId === room.hostUserId,
        ready: participant.ready,
        purseRemainingLakhs: participant.purseRemainingLakhs,
        slotsRemaining: participant.slotsRemaining,
        overseasCount: participant.overseasCount,
        joinedAt: participant.joinedAt.toISOString()
      })),
      currentLot,
      recentBids: recentBids.map((bid) => ({
        id: bid.id,
        roomId: bid.roomId,
        poolEntryId: bid.poolEntryId,
        userId: bid.userId,
        displayName: buildDisplayName(bid.user),
        amountLakhs: bid.amountLakhs,
        createdAt: bid.createdAt.toISOString()
      })),
      rosters: [...rosterMap.values()],
      selectedPlayerIds: selectedPlayerRows.map((entry) => entry.playerId),
      pendingPlayerCount,
      totalPoolCount,
      skipVoteUserIds: currentLotSkipVotes.map((row) => row.userId),
      withdrawnUserIds: currentLotWithdrawals.map((row) => row.userId),
      eventLog: eventRows
        .map((row) => ({
          id: row.id,
          type: row.type as AuctionEventLogEntry["type"],
          actorUserId: row.actorUserId ?? undefined,
          message: row.message,
          createdAt: row.createdAt.toISOString()
        }))
        .reverse()
    };
  }

  private async roomNeedsAdvance(
    tx: Prisma.TransactionClient,
    roomId: string,
    now: string
  ) {
    const room = await tx.auctionRoom.findUnique({
      where: { id: roomId },
      select: {
        state: true,
        currentPoolEntryId: true,
        lotEndsAt: true
      }
    });

    if (!room || room.state !== "live") {
      return false;
    }

    if (!room.currentPoolEntryId) {
      return true;
    }

    return Boolean(room.lotEndsAt && room.lotEndsAt.getTime() <= new Date(now).getTime());
  }

  private toAuctionLot(
    entry: {
      id: string;
      playerId: string;
      nominationOrder: number;
      state: string;
      soldPriceLakhs: number | null;
      soldToUserId: string | null;
      roomId: string;
      nominatedAt: Date | null;
      closedAt: Date | null;
      player: {
        id: string;
        name: string;
        teamId: string;
        role: string;
        nationality: string;
        team: {
          name: string;
          shortName: string;
        };
      };
      soldTo?: {
        name: string;
        profile?: { username: string } | null;
      } | null;
    },
    basePriceLakhs: number,
    currentBidLakhs: number | null,
    currentLeaderUserId: string | null,
    lotEndsAt: Date | null
  ): AuctionLot {
    return {
      poolEntryId: entry.id,
      playerId: entry.playerId,
      playerName: entry.player.name,
      teamId: entry.player.teamId,
      teamName: entry.player.team.name,
      teamShortName: entry.player.team.shortName,
      role: entry.player.role as TeamRole,
      nationality: entry.player.nationality as PlayerNationality,
      nominationOrder: entry.nominationOrder,
      openingBidLakhs: basePriceLakhs,
      currentBidLakhs: currentBidLakhs ?? undefined,
      currentLeaderUserId: currentLeaderUserId ?? undefined,
      lotEndsAt: lotEndsAt?.toISOString(),
      state: entry.state as AuctionLot["state"],
      soldPriceLakhs: entry.soldPriceLakhs ?? undefined,
      soldToUserId: entry.soldToUserId ?? undefined,
      soldToDisplayName: entry.soldTo ? buildDisplayName(entry.soldTo) : undefined
    };
  }

  private async advanceAuctionRoom(roomId: string, now: string) {
    return this.runRoomTransaction(
      roomId,
      (tx) => this.advanceAuctionRoomLocked(tx, roomId, now),
    );
  }

  private async advanceAuctionRoomLocked(tx: DbClient, roomId: string, now: string): Promise<boolean> {
    let changed = false;

    while (true) {
      const actionNow = new Date().toISOString();
      const context = await this.loadMutableRoomContext(tx, roomId);
      if (!context.room || context.room.state !== "live") {
        return changed;
      }

      if (!context.currentEntry || !context.currentPlayer) {
        if (context.participants.every((participant) => participant.slotsRemaining <= 0)) {
          await tx.auctionRoom.update({
            where: { id: roomId },
            data: {
              state: "completed",
              completedAt: new Date(actionNow)
            }
          });
          await this.logEvent(tx, roomId, "auction-completed", null, "Auction completed.");
          return true;
        }

        const nextPending = context.poolEntries
          .filter((entry) => entry.state === "pending")
          .sort((left, right) => left.nominationOrder - right.nominationOrder);

        let nominated = false;
        for (const entry of nextPending) {
          const player = context.playerById.get(entry.playerId);
          if (!player) {
            continue;
          }
          const eligibleParticipants = this.eligibleParticipantsForLot(
            context.room,
            context.participants,
            player,
            null
          );

          if (eligibleParticipants.length === 0) {
            const closeNow = new Date().toISOString();
            await tx.auctionPoolEntry.update({
              where: { id: entry.id },
              data: {
                state: "unsold",
                closedAt: new Date(closeNow)
              }
            });
            await this.logEvent(
              tx,
              roomId,
              "player-unsold",
              null,
              `${player.name} went unsold.`,
              { poolEntryId: entry.id }
            );
            changed = true;
            continue;
          }

          const nominationNow = new Date().toISOString();
          await tx.auctionPoolEntry.update({
            where: { id: entry.id },
            data: {
              state: "active",
              nominatedAt: new Date(nominationNow)
            }
          });
          await tx.auctionRoom.update({
            where: { id: roomId },
            data: {
              currentPoolEntryId: entry.id,
              currentBidLakhs: null,
              currentLeaderUserId: null,
              lotOpenedAt: new Date(nominationNow),
              lotEndsAt: earliestClosingTime(nominationNow, context.room.bidWindowSeconds)
            }
          });
          await this.logEvent(
            tx,
            roomId,
            "player-nominated",
            null,
            `${player.name} is now up for bidding.`,
            { poolEntryId: entry.id }
          );
          changed = true;
          nominated = true;
          break;
        }

        if (nominated) {
          return true;
        }

        await tx.auctionRoom.update({
          where: { id: roomId },
          data: {
            state: "completed",
            completedAt: new Date(actionNow)
          }
        });
        await this.logEvent(tx, roomId, "auction-completed", null, "Auction completed.");
        return true;
      }

      const eligibleParticipants = this.eligibleParticipantsForLot(
        context.room,
        context.participants,
        context.currentPlayer,
        context.room.currentBidLakhs ?? null
      );
      const skipVoteSet = new Set(context.skipVotes.map((vote) => vote.userId));
      const withdrawalSet = new Set(context.withdrawals.map((vote) => vote.userId));
      const lotExpired =
        context.room.lotEndsAt &&
        new Date(context.room.lotEndsAt).getTime() <= new Date(actionNow).getTime();

      const shouldCloseUnsold =
        !context.room.currentLeaderUserId &&
        (eligibleParticipants.length === 0 ||
          lotExpired ||
          eligibleParticipants.every(
            (participant) =>
              skipVoteSet.has(participant.userId) || withdrawalSet.has(participant.userId)
          ));

      const shouldCloseSold =
        Boolean(context.room.currentLeaderUserId) &&
        (lotExpired ||
          eligibleParticipants
            .filter((participant) => participant.userId !== context.room.currentLeaderUserId)
            .every((participant) => withdrawalSet.has(participant.userId)));

      if (!shouldCloseUnsold && !shouldCloseSold) {
        return changed;
      }

      if (shouldCloseSold && context.room.currentLeaderUserId && context.room.currentBidLakhs) {
        const leaderSeat = context.seatByUserId.get(context.room.currentLeaderUserId);
        if (!leaderSeat) {
          throw new Error("Auction leader is no longer part of the room.");
        }
        const soldNow = new Date().toISOString();

        await tx.auctionPoolEntry.update({
          where: { id: context.currentEntry.id },
          data: {
            state: "sold",
            soldToUserId: context.room.currentLeaderUserId,
            soldPriceLakhs: context.room.currentBidLakhs,
            closedAt: new Date(soldNow)
          }
        });

        await tx.auctionParticipant.update({
          where: {
            roomId_userId: {
              roomId,
              userId: context.room.currentLeaderUserId
            }
          },
          data: {
            purseRemainingLakhs: {
              decrement: context.room.currentBidLakhs
            },
            slotsRemaining: {
              decrement: 1
            },
            overseasCount: isOverseas(context.currentPlayer.nationality)
              ? {
                  increment: 1
                }
              : undefined
          }
        });

        await tx.auctionRoom.update({
          where: { id: roomId },
          data: {
            currentPoolEntryId: null,
            currentBidLakhs: null,
            currentLeaderUserId: null,
            lotOpenedAt: null,
            lotEndsAt: null
          }
        });

        await this.logEvent(
          tx,
          roomId,
          "player-sold",
          context.room.currentLeaderUserId,
          `${context.currentPlayer.name} sold for ₹${(context.room.currentBidLakhs / 100).toFixed(2)} crore.`,
          {
            poolEntryId: context.currentEntry.id,
            soldToUserId: context.room.currentLeaderUserId,
            soldPriceLakhs: context.room.currentBidLakhs
          }
        );
        changed = true;
        continue;
      }

      const unsoldNow = new Date().toISOString();
      await tx.auctionPoolEntry.update({
        where: { id: context.currentEntry.id },
        data: {
          state: "unsold",
          closedAt: new Date(unsoldNow)
        }
      });
      await tx.auctionRoom.update({
        where: { id: roomId },
        data: {
          currentPoolEntryId: null,
          currentBidLakhs: null,
          currentLeaderUserId: null,
          lotOpenedAt: null,
          lotEndsAt: null
        }
      });
      await this.logEvent(
        tx,
        roomId,
        "player-unsold",
        null,
        `${context.currentPlayer.name} went unsold.`,
        {
          poolEntryId: context.currentEntry.id
        }
      );
      changed = true;
    }
  }

  private eligibleParticipantsForLot(
    room: {
      basePriceLakhs: number;
      currentBidLakhs: number | null;
      maxOverseas: number;
    },
    participants: Array<{
      userId: string;
      purseRemainingLakhs: number;
      slotsRemaining: number;
      overseasCount: number;
    }>,
    player: {
      nationality: string;
    },
    currentBidLakhs: number | null
  ) {
    const requiredBid = minimumBidLakhs(room.basePriceLakhs, currentBidLakhs);
    return participants.filter((participant) => {
      if (participant.slotsRemaining <= 0) {
        return false;
      }
      if (isOverseas(player.nationality) && participant.overseasCount >= room.maxOverseas) {
        return false;
      }
      return canAffordBid(participant, requiredBid, room.basePriceLakhs);
    });
  }

  private async loadMutableRoomContext(tx: DbClient, roomId: string) {
    const room = await tx.auctionRoom.findUnique({
      where: { id: roomId }
    });
    if (!room) {
      throw new Error("Auction room not found.");
    }

    const [participants, poolEntries] = await Promise.all([
      tx.auctionParticipant.findMany({
        where: { roomId },
        orderBy: [{ joinedAt: "asc" }]
      }),
      tx.auctionPoolEntry.findMany({
        where: { roomId }
      })
    ]);
    const currentEntry = room.currentPoolEntryId
      ? await tx.auctionPoolEntry.findUnique({
          where: { id: room.currentPoolEntryId }
        })
      : null;
    const [currentBids, skipVotes, withdrawals, players] = await Promise.all([
      room.currentPoolEntryId
        ? tx.auctionBid.findMany({
            where: { poolEntryId: room.currentPoolEntryId }
          })
        : Promise.resolve([]),
      room.currentPoolEntryId
        ? tx.auctionSkipVote.findMany({
            where: { poolEntryId: room.currentPoolEntryId }
          })
        : Promise.resolve([]),
      room.currentPoolEntryId
        ? tx.auctionWithdrawal.findMany({
            where: { poolEntryId: room.currentPoolEntryId }
          })
        : Promise.resolve([]),
      tx.player.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                [
                  ...poolEntries.map((entry) => entry.playerId),
                  currentEntry?.playerId
                ].filter((value): value is string => Boolean(value))
              )
            ]
          }
        }
      })
    ]);

    return {
      room,
      participants,
      seatByUserId: new Map(participants.map((participant) => [participant.userId, participant])),
      poolEntries,
      currentEntry,
      currentBids,
      currentPlayer: currentEntry
        ? players.find((player) => player.id === currentEntry.playerId) ?? null
        : null,
      playerById: new Map(players.map((player) => [player.id, player])),
      skipVotes,
      withdrawals
    };
  }

  private assertParticipantAccess(
    context: { room: { visibility: string; hostUserId: string }; seatByUserId: Map<string, unknown> },
    userId: string,
    requireParticipant: boolean
  ) {
    const isParticipant = context.seatByUserId.has(userId);
    if (requireParticipant && !isParticipant) {
      throw new Error("You are not part of this auction room.");
    }
    if (
      !requireParticipant &&
      context.room.visibility === "private" &&
      !isParticipant &&
      context.room.hostUserId !== userId
    ) {
      throw new Error("This auction room is private.");
    }
  }

  private async logEvent(
    tx: DbClient,
    roomId: string,
    type: AuctionEventLogEntry["type"],
    actorUserId: string | null,
    message: string,
    payload: Record<string, unknown> = {}
  ) {
    await tx.auctionEventLog.create({
      data: {
        id: randomUUID(),
        roomId,
        actorUserId,
        type,
        message,
        payload: payload as Prisma.InputJsonValue
      }
    });
  }
}
