import { createServer } from "node:http";

import express from "express";

import { configureApp } from "./app.js";
import { createSeedStore } from "./data/seed.js";
import { loadEnv } from "./lib/env.js";
import type { ApiDependencies } from "./lib/http.js";
import { createJobManager } from "./lib/jobs.js";
import { createRealtimeHub } from "./lib/socket.js";
import {
  InMemoryAppRepository,
  type AppRepository
} from "./repositories/app-repository.js";
import { PrismaAppRepository } from "./repositories/prisma-app-repository.js";
import { AdminService } from "./services/admin-service.js";
import { AuthService } from "./services/auth-service.js";
import { GameService } from "./services/game-service.js";

const env = loadEnv();
const seedStore = createSeedStore();

async function createRuntime(): Promise<{
  repository: AppRepository;
  authService: AuthService;
  gameService: GameService;
  storageMode: "prisma" | "memory";
}> {
  const prismaRepository = new PrismaAppRepository();

  try {
    await prismaRepository.initialize(seedStore);
    const authService = new AuthService(prismaRepository);
    const gameService = new GameService(prismaRepository);
    await gameService.initialize();

    return {
      repository: prismaRepository,
      authService,
      gameService,
      storageMode: "prisma"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error.";
    // eslint-disable-next-line no-console
    console.warn(`Prisma startup failed, falling back to in-memory storage. ${message}`);

    const memoryRepository = new InMemoryAppRepository(seedStore);
    await memoryRepository.initialize(seedStore);
    const authService = new AuthService(memoryRepository);
    const gameService = new GameService(memoryRepository);
    await gameService.initialize();

    return {
      repository: memoryRepository,
      authService,
      gameService,
      storageMode: "memory"
    };
  }
}

const { authService, gameService, storageMode } = await createRuntime();
const jobs = createJobManager(env);
const adminService = new AdminService(gameService, jobs);

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
  // eslint-disable-next-line no-console
  console.log(
    `API listening on http://localhost:${env.PORT} using ${storageMode} storage (CORS: ${env.CORS_ALLOWED_ORIGINS.join(", ")})`
  );
});
