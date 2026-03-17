import { Router, type Router as ExpressRouter } from "express";

import { adminCorrectionSchema, settlePredictionSchema } from "@fantasy-cricket/validators";

import { authenticatedAdminUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createAdminRouter({ adminService, authService, gameService, realtime }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.post("/provider-sync", async (req, res) => {
    try {
      await authenticatedAdminUserId(req, authService);
    } catch (error) {
      sendError(res, 403, error, "Provider sync failed.");
      return;
    }

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
      await authenticatedAdminUserId(req, authService);
    } catch (error) {
      sendError(res, 403, error, "Correction failed.");
      return;
    }

    try {
      const result = await adminService.applyCorrection(req.params.matchId, parsed.data);
      realtime.emitUserRefresh(
        await gameService.matchSubscriberIds(req.params.matchId),
        "score-correction"
      );
      res.json(result);
    } catch (error) {
      sendError(res, 400, error, "Correction failed.");
    }
  });

  router.post("/predictions/:questionId/settle", async (req, res) => {
    const parsed = settlePredictionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid settlement." });
      return;
    }

    try {
      await authenticatedAdminUserId(req, authService);
    } catch (error) {
      sendError(res, 403, error, "Settlement failed.");
      return;
    }

    try {
      const result = await adminService.settlePrediction(req.params.questionId, parsed.data);
      realtime.emitUserRefresh(await gameService.allUserIds(), "prediction-settled");
      res.json(result);
    } catch (error) {
      sendError(res, 400, error, "Settlement failed.");
    }
  });

  return router;
}
