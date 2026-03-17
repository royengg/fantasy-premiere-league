import { createServer } from "node:http";

import express from "express";

import { configureApp } from "./app.js";
import { createBootstrapStore } from "./data/seed.js";
import { loadEnv } from "./lib/env.js";
import type { ApiDependencies } from "./lib/http.js";
import { createRealtimeHub } from "./lib/socket.js";
import { PrismaAppRepository } from "./repositories/prisma-app-repository.js";
import { AdminService } from "./services/admin-service.js";
import { AuthService } from "./services/auth-service.js";
import { GameService } from "./services/game-service.js";
import { ProviderSyncScheduler } from "./services/provider-sync-scheduler.js";

const env = loadEnv();
const seedStore = createBootstrapStore();

async function createRuntime(): Promise<{
  repository: PrismaAppRepository;
  authService: AuthService;
  gameService: GameService;
}> {
  const prismaRepository = new PrismaAppRepository();
  await prismaRepository.initialize(seedStore);
  const authService = new AuthService(prismaRepository);
  const gameService = new GameService(prismaRepository);
  await gameService.initialize();

  return {
    repository: prismaRepository,
    authService,
    gameService
  };
}

async function main() {
  const { repository, authService, gameService } = await createRuntime();
  const adminService = new AdminService(gameService);
  const providerSyncScheduler = new ProviderSyncScheduler(env, repository, gameService);

  const app = express();
  const server = createServer(app);
  const realtime = createRealtimeHub(server, env.CORS_ALLOWED_ORIGINS, authService);
  configureApp(app, {
    env,
    authService,
    gameService,
    adminService,
    realtime
  } satisfies ApiDependencies);

  server.listen(env.PORT, () => {
    providerSyncScheduler.start();
    // eslint-disable-next-line no-console
    console.log(
      `API listening on http://localhost:${env.PORT} using Prisma/Neon storage (CORS: ${env.CORS_ALLOWED_ORIGINS.join(", ")})`
    );
  });
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown database error.";
  // eslint-disable-next-line no-console
  console.error(`API startup failed: ${message}`);
  process.exit(1);
});
