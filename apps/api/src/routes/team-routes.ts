import { Router, type Router as ExpressRouter } from "express";

import { authenticatedUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createTeamRouter({ authService, gameService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not load teams.");
      return;
    }

    try {
      res.json(await gameService.getTeamsWithPlayers());
    } catch (error) {
      sendError(res, 404, error, "Could not load teams.");
    }
  });

  return router;
}
