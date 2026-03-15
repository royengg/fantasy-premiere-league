import { Router, type Router as ExpressRouter } from "express";

import type { ApiDependencies } from "../lib/http.js";

export function createHealthRouter({ gameService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/health", async (_req, res) => {
    res.json({
      status: "ok",
      provider: await gameService.getProviderStatus()
    });
  });

  return router;
}
