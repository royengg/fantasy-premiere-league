import cors from "cors";
import express, { type Express } from "express";

import { createCorsOptions } from "./lib/cors.js";
import { type ApiDependencies } from "./lib/http.js";
import { createAuctionRouter } from "./routes/auction-routes.js";
import { createAdminRouter } from "./routes/admin-routes.js";
import { createAuthRouter } from "./routes/auth-routes.js";
import { createBootstrapRouter } from "./routes/bootstrap-routes.js";
import { createContestRouter } from "./routes/contest-routes.js";
import { createHealthRouter } from "./routes/health-routes.js";
import { createHomeRouter } from "./routes/home-routes.js";
import { createInventoryRouter } from "./routes/inventory-routes.js";
import { createLeagueRouter } from "./routes/league-routes.js";
import { createPredictionRouter } from "./routes/prediction-routes.js";
import { createTeamRouter } from "./routes/team-routes.js";

export function configureApp(app: Express, dependencies: ApiDependencies): void {
  app.use(cors(createCorsOptions(dependencies.env.CORS_ALLOWED_ORIGINS)));
  app.use(express.json({ limit: "64kb" }));

  app.use("/api", createHealthRouter(dependencies));
  app.use("/api", createBootstrapRouter(dependencies));
  app.use("/api", createHomeRouter(dependencies));
  app.use("/api/auth", createAuthRouter(dependencies));
  app.use("/api/auctions", createAuctionRouter(dependencies));
  app.use("/api/contests", createContestRouter(dependencies));
  app.use("/api/leagues", createLeagueRouter(dependencies));
  app.use("/api/predictions", createPredictionRouter(dependencies));
  app.use("/api/inventory", createInventoryRouter(dependencies));
  app.use("/api/teams", createTeamRouter(dependencies));
  app.use("/api/admin", createAdminRouter(dependencies));
}
