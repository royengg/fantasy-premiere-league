import { Router, type Router as ExpressRouter } from "express";

import { sendError, type ApiDependencies } from "../lib/http.js";
import { cricketDataService } from "../services/cricket-data-service.js";

export function createCricketDataRouter(dependencies: ApiDependencies): ExpressRouter {
  const router = Router();

  router.get("/series", async (req, res) => {
    try {
      const series = await cricketDataService.getSeries();
      res.json({ data: series });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch series");
    }
  });

  router.get("/series/:seriesId", async (req, res) => {
    try {
      const series = await cricketDataService.getSeries(req.params.seriesId);
      res.json({ data: series });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch series");
    }
  });

  router.get("/matches", async (req, res) => {
    try {
      const { seriesId, status, date } = req.query;
      const matches = await cricketDataService.getMatches({
        seriesId: seriesId as string | undefined,
        status: status as "upcoming" | "live" | "completed" | undefined,
        date: date as string | undefined,
      });
      res.json({ data: matches });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch matches");
    }
  });

  router.get("/matches/live", async (req, res) => {
    try {
      const matches = await cricketDataService.getLiveMatches();
      res.json({ data: matches });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch live matches");
    }
  });

  router.get("/matches/upcoming", async (req, res) => {
    try {
      const days = req.query.days ? Number(req.query.days) : 7;
      const matches = await cricketDataService.getUpcomingMatches(days);
      res.json({ data: matches });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch upcoming matches");
    }
  });

  router.get("/matches/:matchId", async (req, res) => {
    try {
      const match = await cricketDataService.getMatch(req.params.matchId);
      res.json({ data: match });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch match");
    }
  });

  router.get("/matches/:matchId/squad", async (req, res) => {
    try {
      const squad = await cricketDataService.getMatchSquad(req.params.matchId);
      res.json({ data: squad });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch squad");
    }
  });

  router.get("/matches/:matchId/live", async (req, res) => {
    try {
      const liveScore = await cricketDataService.getLiveScore(req.params.matchId);
      res.json({ data: liveScore });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch live score");
    }
  });

  router.get("/matches/:matchId/scorecard", async (req, res) => {
    try {
      const scorecard = await cricketDataService.getScorecard(req.params.matchId);
      res.json({ data: scorecard });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch scorecard");
    }
  });

  router.get("/players", async (req, res) => {
    try {
      const { teamId } = req.query;
      const players = await cricketDataService.getPlayers(teamId as string | undefined);
      res.json({ data: players });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch players");
    }
  });

  router.get("/players/:playerId", async (req, res) => {
    try {
      const player = await cricketDataService.getPlayer(req.params.playerId);
      res.json({ data: player });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch player");
    }
  });

  router.get("/ipl", async (req, res) => {
    try {
      const season = req.query.season ? Number(req.query.season) : undefined;
      const matches = await cricketDataService.getIPLMatches(season);
      res.json({ data: matches });
    } catch (error) {
      sendError(res, 500, error, "Failed to fetch IPL matches");
    }
  });

  router.get("/usage", (req, res) => {
    const usage = cricketDataService.getApiUsage();
    res.json(usage);
  });

  return router;
}