import { Router, type Router as ExpressRouter } from "express";

import { currentUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createBootstrapRouter({ gameService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/bootstrap", (req, res) => {
    try {
      res.json(gameService.getDashboard(currentUserId(req)));
    } catch (error) {
      sendError(res, 404, error, "Bootstrap failed.");
    }
  });

  return router;
}
