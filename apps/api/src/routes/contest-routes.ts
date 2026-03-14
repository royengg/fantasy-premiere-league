import { Router, type Router as ExpressRouter } from "express";

import { submitRosterSchema } from "@fantasy-cricket/validators";

import { currentUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createContestRouter({ gameService, realtime }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/", (req, res) => {
    try {
      res.json(gameService.getDashboard(currentUserId(req)).contests);
    } catch (error) {
      sendError(res, 404, error, "Could not load contests.");
    }
  });

  router.post("/:contestId/roster", (req, res) => {
    const parsed = submitRosterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid roster." });
      return;
    }

    try {
      const userId = currentUserId(req);
      const roster = gameService.submitRoster(userId, req.params.contestId, parsed.data);
      const leaderboard = gameService
        .getDashboard(userId)
        .leaderboard.filter((entry) => entry.contestId === req.params.contestId);

      realtime.emitLeaderboard(req.params.contestId, leaderboard);
      res.status(201).json(roster);
    } catch (error) {
      sendError(res, 400, error, "Roster submission failed.");
    }
  });

  return router;
}
