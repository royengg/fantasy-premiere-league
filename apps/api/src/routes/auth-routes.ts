import { Router, type Router as ExpressRouter } from "express";

import { authBootstrapSchema } from "@fantasy-cricket/validators";

import type { ApiDependencies } from "../lib/http.js";

export function createAuthRouter({ authService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.post("/bootstrap", (req, res) => {
    const parsed = authBootstrapSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid auth payload." });
      return;
    }

    const session = authService.bootstrap(parsed.data);
    res.status(201).json(session);
  });

  return router;
}
