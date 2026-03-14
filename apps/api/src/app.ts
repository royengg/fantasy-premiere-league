import cors from "cors";
import express, { type Express } from "express";

import { type ApiDependencies } from "./lib/http.js";
import { createAdminRouter } from "./routes/admin-routes.js";
import { createAuthRouter } from "./routes/auth-routes.js";
import { createBootstrapRouter } from "./routes/bootstrap-routes.js";
import { createContestRouter } from "./routes/contest-routes.js";
import { createCricketDataRouter } from "./routes/cricket-data-routes.js";
import { createHealthRouter } from "./routes/health-routes.js";
import { createInventoryRouter } from "./routes/inventory-routes.js";
import { createLeagueRouter } from "./routes/league-routes.js";
import { createPredictionRouter } from "./routes/prediction-routes.js";

export function configureApp(app: Express, dependencies: ApiDependencies): void {
  app.use(cors({ origin: dependencies.env.CORS_ORIGIN }));
  app.use(express.json());

  app.use("/api", createHealthRouter(dependencies));
  app.use("/api", createBootstrapRouter(dependencies));
  app.use("/api/auth", createAuthRouter(dependencies));
  app.use("/api/contests", createContestRouter(dependencies));
  app.use("/api/leagues", createLeagueRouter(dependencies));
  app.use("/api/predictions", createPredictionRouter(dependencies));
  app.use("/api/inventory", createInventoryRouter(dependencies));
  app.use("/api/admin", createAdminRouter(dependencies));
  app.use("/api/cricket", createCricketDataRouter(dependencies));
}
