import { Router, type Router as ExpressRouter } from "express";

import { authenticatedUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createHomeRouter({ authService, gameService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/home", async (req, res) => {
    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not load home.");
      return;
    }

    try {
      res.json(await gameService.getHomePage(userId));
    } catch (error) {
      sendError(res, 404, error, "Could not load home.");
    }
  });

  return router;
}
