import { createServer } from "node:http";

import express from "express";

import { configureApp } from "./app.js";
import { createBootstrapStore } from "./data/seed.js";
import { loadEnv } from "./lib/env.js";
import type { ApiDependencies } from "./lib/http.js";
import { createRealtimeHub } from "./lib/socket.js";
import { PrismaAuctionRepository } from "./repositories/prisma-auction-repository.js";
import { PrismaAppRepository } from "./repositories/prisma-app-repository.js";
import { AdminService } from "./services/admin-service.js";
import { AuctionRoomScheduler } from "./services/auction-room-scheduler.js";
import { AuctionService } from "./services/auction-service.js";
import { AuthService } from "./services/auth-service.js";
import { GameService } from "./services/game-service.js";
import { ProviderSyncScheduler } from "./services/provider-sync-scheduler.js";
import { cricketDataService } from "./services/cricket-data-service.js";

const env = loadEnv();
const seedStore = createBootstrapStore();

async function createRuntime(): Promise<{
  repository: PrismaAppRepository;
  authService: AuthService;
  gameService: GameService;
  auctionService: AuctionService;
}> {
  const prismaRepository = new PrismaAppRepository();
  const prismaAuctionRepository = new PrismaAuctionRepository();
  await prismaRepository.initialize(seedStore);
  cricketDataService.configureBudgetStore(prismaRepository);
  const authService = new AuthService(prismaRepository);
  const gameService = new GameService(prismaRepository);
  const auctionService = new AuctionService(prismaAuctionRepository);
  await gameService.initialize();

  return {
    repository: prismaRepository,
    authService,
    gameService,
    auctionService
  };
}

async function main() {
  const { repository, authService, gameService, auctionService } = await createRuntime();
  const adminService = new AdminService(gameService);
  const providerSyncScheduler = new ProviderSyncScheduler(env, repository, gameService);

  const app = express();
  const server = createServer(app);
  const realtime = createRealtimeHub(server, env.CORS_ALLOWED_ORIGINS, authService);
  const auctionRoomScheduler = new AuctionRoomScheduler(auctionService, realtime);
  configureApp(app, {
    env,
    authService,
    gameService,
    auctionService,
    adminService,
    realtime
  } satisfies ApiDependencies);

  server.listen(env.PORT, () => {
    providerSyncScheduler.start();
    auctionRoomScheduler.start();
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
