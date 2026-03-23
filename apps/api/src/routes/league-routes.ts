import { Router, type Router as ExpressRouter } from "express";

import { createLeagueSchema, joinLeagueSchema } from "@fantasy-cricket/validators";

import { authenticatedUserId, sendError, type ApiDependencies } from "../lib/http.js";

export function createLeagueRouter({ authService, gameService, realtime }: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/", async (req, res) => {
    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not load leagues.");
      return;
    }

    try {
      res.json(await gameService.getLeagues(userId));
    } catch (error) {
      sendError(res, 404, error, "Could not load leagues.");
    }
  });

  router.post("/", async (req, res) => {
    const parsed = createLeagueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid league." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not create league.");
      return;
    }

    try {
      const league = await gameService.createLeague(userId, parsed.data);
      realtime.emitLeagueActivity(
        await gameService.leagueMemberIds(league.id),
        league.id,
        `League ${league.name} created.`
      );
      res.status(201).json(league);
    } catch (error) {
      sendError(res, 400, error, "Could not create league.");
    }
  });

  router.post("/join", async (req, res) => {
    const parsed = joinLeagueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid invite." });
      return;
    }

    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not join league.");
      return;
    }

    try {
      const league = await gameService.joinLeague(userId, parsed.data);
      realtime.emitLeagueActivity(
        await gameService.leagueMemberIds(league.id),
        league.id,
        `User ${userId} joined.`
      );
      res.json(league);
    } catch (error) {
      sendError(res, 400, error, "Could not join league.");
    }
  });

  router.delete("/:leagueId", async (req, res) => {
    let userId: string;
    try {
      userId = await authenticatedUserId(req, authService);
    } catch (error) {
      sendError(res, 401, error, "Could not delete league.");
      return;
    }

    try {
      const result = await gameService.deleteLeague(userId, req.params.leagueId);
      res.json(result);
    } catch (error) {
      sendError(res, 400, error, "Could not delete league.");
    }
  });

  return router;
}
