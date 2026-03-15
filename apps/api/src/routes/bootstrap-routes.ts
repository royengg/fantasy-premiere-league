import { Router, type Router as ExpressRouter } from "express";

import { authenticatedUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createBootstrapRouter({ authService, gameService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/bootstrap", async (req, res) => {
    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Bootstrap failed.");
      return;
    }

    try {
      res.json(await gameService.getDashboard(userId));
    } catch (error) {
      sendError(res, 404, error, "Bootstrap failed.");
    }
  });

  return router;
}
