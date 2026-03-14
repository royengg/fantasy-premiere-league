import { Router, type Router as ExpressRouter } from "express";

import { predictionAnswerSchema } from "@fantasy-cricket/validators";

import { currentUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createPredictionRouter({ gameService }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/", (req, res) => {
    try {
      const dashboard = gameService.getDashboard(currentUserId(req));
      res.json({
        questions: dashboard.questions,
        answers: dashboard.answers,
        results: dashboard.results
      });
    } catch (error) {
      sendError(res, 404, error, "Could not load predictions.");
    }
  });

  router.post("/:questionId/answer", (req, res) => {
    const parsed = predictionAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid answer." });
      return;
    }

    try {
      const answer = gameService.answerPrediction(currentUserId(req), req.params.questionId, parsed.data);
      res.status(201).json(answer);
    } catch (error) {
      sendError(res, 400, error, "Answer failed.");
    }
  });

  return router;
}
