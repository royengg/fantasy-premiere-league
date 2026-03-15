import { Router, type Router as ExpressRouter } from "express";

import { submitRosterSchema } from "@fantasy-cricket/validators";

import { authenticatedUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createContestRouter({ authService, gameService, realtime }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/", async (req, res) => {
    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not load contests.");
      return;
    }

    try {
      res.json((await gameService.getDashboard(userId)).contests);
    } catch (error) {
      sendError(res, 404, error, "Could not load contests.");
    }
  });

  router.post("/:contestId/roster", async (req, res) => {
    const parsed = submitRosterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid roster." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Roster submission failed.");
      return;
    }

    try {
      const roster = await gameService.submitRoster(userId, req.params.contestId, parsed.data);
      const leaderboard = (await gameService
        .getDashboard(userId))
        .leaderboard.filter((entry) => entry.contestId === req.params.contestId);
      const subscriberIds = await gameService.contestSubscriberIds(req.params.contestId);

      realtime.emitLeaderboard(subscriberIds, req.params.contestId, leaderboard);
      res.status(201).json(roster);
    } catch (error) {
      sendError(res, 400, error, "Roster submission failed.");
    }
  });

  return router;
}
