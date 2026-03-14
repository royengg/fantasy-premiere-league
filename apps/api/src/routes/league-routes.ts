import { Router, type Router as ExpressRouter } from "express";

import { createLeagueSchema, joinLeagueSchema } from "@fantasy-cricket/validators";

import { currentUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createLeagueRouter({ gameService, realtime }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/", (req, res) => {
    try {
      res.json(gameService.getDashboard(currentUserId(req)).leagues);
    } catch (error) {
      sendError(res, 404, error, "Could not load leagues.");
    }
  });

  router.post("/", (req, res) => {
    const parsed = createLeagueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid league." });
      return;
    }

    try {
      const league = gameService.createLeague(currentUserId(req), parsed.data);
      realtime.emitLeagueActivity(league.id, `League ${league.name} created.`);
      res.status(201).json(league);
    } catch (error) {
      sendError(res, 400, error, "Could not create league.");
    }
  });

  router.post("/join", (req, res) => {
    const parsed = joinLeagueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid invite." });
      return;
    }

    try {
      const userId = currentUserId(req);
      const league = gameService.joinLeague(userId, parsed.data);
      realtime.emitLeagueActivity(league.id, `User ${userId} joined.`);
      res.json(league);
    } catch (error) {
      sendError(res, 400, error, "Could not join league.");
    }
  });

  return router;
}
