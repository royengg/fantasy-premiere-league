import { createServer } from "node:http";

import express from "express";

import { configureApp } from "./app.js";
import { createSeedStore } from "./data/seed.js";
import { loadEnv } from "./lib/env.js";
import type { ApiDependencies } from "./lib/http.js";
import { createJobManager } from "./lib/jobs.js";
import { createRealtimeHub } from "./lib/socket.js";
import { AdminService } from "./services/admin-service.js";
import { AuthService } from "./services/auth-service.js";
import { GameService } from "./services/game-service.js";

const env = loadEnv();
const store = createSeedStore();
const authService = new AuthService(store);
const gameService = new GameService(store);
const jobs = createJobManager(env);
const adminService = new AdminService(gameService, jobs);

const app = express();
const server = createServer(app);
const realtime = createRealtimeHub(server, env.CORS_ORIGIN);
configureApp(app, {
  env,
  store,
  authService,
  gameService,
  adminService,
  realtime
} satisfies ApiDependencies);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT}`);
});
