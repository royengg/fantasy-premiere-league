import { Router, type Router as ExpressRouter } from "express";

import type { ApiDependencies } from "../lib/http.js";

export function createHealthRouter({ store }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      provider: store.provider
    });
  });

  return router;
}
