import type { Request, Response } from "express";

import type { AppStore } from "../data/store.js";
import type { Env } from "./env.js";
import type { RealtimeHub } from "./socket.js";
import type { AdminService } from "../services/admin-service.js";
import type { AuthService } from "../services/auth-service.js";
import type { GameService } from "../services/game-service.js";

export interface ApiDependencies {
  env: Env;
  store: AppStore;
  authService: AuthService;
  gameService: GameService;
  adminService: AdminService;
  realtime: RealtimeHub;
}

export function currentUserId(req: Request): string {
  return String(req.header("x-user-id") ?? "user-1");
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function sendError(res: Response, status: number, error: unknown, fallback: string) {
  res.status(status).json({ message: errorMessage(error, fallback) });
}

