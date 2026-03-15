import { Router, type Router as ExpressRouter } from "express";

import { predictionAnswerSchema } from "@fantasy-cricket/validators";

import { authenticatedUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createPredictionRouter({ authService, gameService, realtime }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/", async (req, res) => {
    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not load predictions.");
      return;
    }

    try {
      const dashboard = await gameService.getDashboard(userId);
      res.json({
        questions: dashboard.questions,
        answers: dashboard.answers,
        results: dashboard.results
      });
    } catch (error) {
      sendError(res, 404, error, "Could not load predictions.");
    }
  });

  router.post("/:questionId/answer", async (req, res) => {
    const parsed = predictionAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid answer." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Answer failed.");
      return;
    }

    try {
      const answer = await gameService.answerPrediction(userId, req.params.questionId, parsed.data);
      realtime.emitUserRefresh([userId], "prediction-answered");
      res.status(201).json(answer);
    } catch (error) {
      sendError(res, 400, error, "Answer failed.");
    }
  });

  return router;
}
