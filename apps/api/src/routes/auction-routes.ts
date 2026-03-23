import { Router, type Router as ExpressRouter } from "express";

import {
  auctionBidSchema,
  auctionLotActionSchema,
  auctionReadySchema,
  createAuctionRoomSchema,
  joinAuctionRoomSchema,
  updateAuctionRoomSettingsSchema
} from "@fantasy-cricket/validators";

import { authenticatedUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createAuctionRouter({
  authService,
  auctionService,
  gameService,
  realtime
}: ApiDependencies): ExpressRouter {
  const router = Router();
  const spawnBroadcast = (task: () => Promise<void>) => {
    void task().catch((error) => {
      // eslint-disable-next-line no-console
      console.warn(
        `Auction broadcast failed: ${error instanceof Error ? error.message : "Unknown error."}`
      );
    });
  };

  const broadcastRoom = async (room: Awaited<ReturnType<typeof auctionService.getRoom>>) => {
    const recipients = new Set(room.participants.map((participant) => participant.userId));
    if (room.room.leagueId) {
      for (const userId of await gameService.leagueMemberIds(room.room.leagueId)) {
        recipients.add(userId);
      }
    }

    if (recipients.size > 0) {
      realtime.emitAuctionRoom([...recipients], room);
    }
  };

  router.get("/", async (req, res) => {
    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not load auction rooms.");
      return;
    }

    try {
      res.json(await auctionService.listRooms(userId));
    } catch (error) {
      sendError(res, 400, error, "Could not load auction rooms.");
    }
  });

  router.get("/catalog/players", async (req, res) => {
    try {
      await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not load auction player catalog.");
      return;
    }

    try {
      res.json(await auctionService.getCatalog());
    } catch (error) {
      sendError(res, 400, error, "Could not load auction player catalog.");
    }
  });

  router.post("/", async (req, res) => {
    const parsed = createAuctionRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid auction room." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not create auction room.");
      return;
    }

    try {
      const room = await auctionService.createRoom(userId, parsed.data);
      res.status(201).json(room);
      spawnBroadcast(async () => {
        await broadcastRoom(room);
        if (room.room.leagueId) {
          realtime.emitLeagueActivity(
            await gameService.leagueMemberIds(room.room.leagueId),
            room.room.leagueId,
            `${room.room.name} lobby opened.`
          );
        }
        realtime.emitAuctionRoomsRefresh();
      });
    } catch (error) {
      sendError(res, 400, error, "Could not create auction room.");
    }
  });

  router.post("/join", async (req, res) => {
    const parsed = joinAuctionRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid auction invite." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not join auction room.");
      return;
    }

    try {
      const room = await auctionService.joinRoom(userId, parsed.data);
      res.json(room);
      spawnBroadcast(async () => {
        await broadcastRoom(room);
        if (room.room.leagueId) {
          realtime.emitLeagueActivity(
            await gameService.leagueMemberIds(room.room.leagueId),
            room.room.leagueId,
            `${userId} joined the auction lobby.`
          );
        }
        realtime.emitAuctionRoomsRefresh();
      });
    } catch (error) {
      sendError(res, 400, error, "Could not join auction room.");
    }
  });

  router.get("/:roomId", async (req, res) => {
    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not load auction room.");
      return;
    }

    try {
      res.json(await auctionService.getRoom(userId, req.params.roomId));
    } catch (error) {
      sendError(res, 404, error, "Could not load auction room.");
    }
  });

  router.patch("/:roomId/settings", async (req, res) => {
    const parsed = updateAuctionRoomSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid room settings." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not update auction room.");
      return;
    }

    try {
      const room = await auctionService.updateRoomSettings(userId, req.params.roomId, parsed.data);
      res.json(room);
      spawnBroadcast(async () => {
        await broadcastRoom(room);
        realtime.emitAuctionRoomsRefresh();
      });
    } catch (error) {
      sendError(res, 400, error, "Could not update auction room.");
    }
  });

  router.post("/:roomId/ready", async (req, res) => {
    const parsed = auctionReadySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid ready state." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not update ready state.");
      return;
    }

    try {
      const room = await auctionService.setReady(userId, req.params.roomId, parsed.data.ready);
      res.json(room);
      spawnBroadcast(async () => {
        await broadcastRoom(room);
        realtime.emitAuctionRoomsRefresh();
      });
    } catch (error) {
      sendError(res, 400, error, "Could not update ready state.");
    }
  });

  router.post("/:roomId/start", async (req, res) => {
    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not start auction.");
      return;
    }

    try {
      const room = await auctionService.startRoom(userId, req.params.roomId);
      res.json(room);
      spawnBroadcast(async () => {
        await broadcastRoom(room);
        realtime.emitAuctionRoomsRefresh();
      });
    } catch (error) {
      sendError(res, 400, error, "Could not start auction.");
    }
  });

  router.post("/:roomId/bid", async (req, res) => {
    const parsed = auctionBidSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid bid." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not place bid.");
      return;
    }

    try {
      const room = await auctionService.placeBid(
        userId,
        req.params.roomId,
        parsed.data.poolEntryId,
        parsed.data.amountLakhs
      );
      res.json(room);
      spawnBroadcast(async () => {
        await broadcastRoom(room);
      });
    } catch (error) {
      sendError(res, 400, error, "Could not place bid.");
    }
  });

  router.post("/:roomId/withdraw", async (req, res) => {
    const parsed = auctionLotActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid auction action." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not withdraw from bidding.");
      return;
    }

    try {
      const room = await auctionService.withdrawFromLot(
        userId,
        req.params.roomId,
        parsed.data.poolEntryId
      );
      res.json(room);
      spawnBroadcast(async () => {
        await broadcastRoom(room);
      });
    } catch (error) {
      sendError(res, 400, error, "Could not withdraw from bidding.");
    }
  });

  router.post("/:roomId/skip", async (req, res) => {
    const parsed = auctionLotActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid auction action." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not vote to skip.");
      return;
    }

    try {
      const room = await auctionService.voteSkip(
        userId,
        req.params.roomId,
        parsed.data.poolEntryId
      );
      res.json(room);
      spawnBroadcast(async () => {
        await broadcastRoom(room);
      });
    } catch (error) {
      sendError(res, 400, error, "Could not vote to skip.");
    }
  });

  return router;
}
