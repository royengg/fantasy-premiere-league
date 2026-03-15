import type { Request, Response } from "express";

import type { Env } from "./env.js";
import type { RealtimeHub } from "./socket.js";
import type { AdminService } from "../services/admin-service.js";
import type { AuthService } from "../services/auth-service.js";
import type { GameService } from "../services/game-service.js";

export interface ApiDependencies {
  env: Env;
  authService: AuthService;
  gameService: GameService;
  adminService: AdminService;
  realtime: RealtimeHub;
}

export function bearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function authenticatedUserId(req: Request, authService: AuthService): Promise<string> {
  return authService.authenticate(bearerToken(req));
}

export function assertAdminKey(req: Request, env: Env) {
  if (req.header("x-admin-key") !== env.ADMIN_API_KEY) {
    throw new Error("Admin authorization failed.");
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function sendError(res: Response, status: number, error: unknown, fallback: string) {
  res.status(status).json({ message: errorMessage(error, fallback) });
}
