import { Router, type Router as ExpressRouter } from "express";

import { authBootstrapSchema } from "@fantasy-cricket/validators";

import type { ApiDependencies } from "../lib/http.js";

export function createAuthRouter({ authService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.post("/bootstrap", async (req, res) => {
    const parsed = authBootstrapSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid auth payload." });
      return;
    }

    try {
      const session = await authService.bootstrap(parsed.data);
      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Auth bootstrap failed." });
    }
  });

  return router;
}
