import { Router, type Router as ExpressRouter } from "express";

import { adminCorrectionSchema } from "@fantasy-cricket/validators";

import { sendError, type ApiDependencies } from "../lib/http.js";

export function createAdminRouter({ adminService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.post("/provider-sync", async (_req, res) => {
    try {
      res.json(await adminService.syncProvider());
    } catch (error) {
      sendError(res, 500, error, "Provider sync failed.");
    }
  });

  router.post("/matches/:matchId/corrections", async (req, res) => {
    const parsed = adminCorrectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid correction." });
      return;
    }

    try {
      res.json(await adminService.applyCorrection(req.params.matchId, parsed.data));
    } catch (error) {
      sendError(res, 400, error, "Correction failed.");
    }
  });

  return router;
}
