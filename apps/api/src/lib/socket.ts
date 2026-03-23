import { Server as HttpServer } from "node:http";

import { Server as SocketServer } from "socket.io";

import type { LeaderboardEntry } from "@fantasy-cricket/types";
import { isAllowedOrigin } from "./cors.js";
import type { AuthService } from "../services/auth-service.js";

export interface RealtimeHub {
  emitLeaderboard: (userIds: string[], contestId: string, leaderboard: LeaderboardEntry[]) => void;
  emitLeagueActivity: (userIds: string[], leagueId: string, message: string) => void;
  emitUserRefresh: (userIds: string[], reason: string) => void;
  emitAuctionRoomsRefresh: () => void;
}

function tokenFromHandshake(socket: { handshake: { auth: Record<string, unknown>; headers: Record<string, unknown> } }) {
  const authToken = socket.handshake.auth.token;
  if (typeof authToken === "string" && authToken.length > 0) {
    return authToken;
  }

  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization !== "string") {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function createRealtimeHub(
  server: HttpServer,
  corsOrigins: readonly string[],
  authService: AuthService
): RealtimeHub {
  const io = new SocketServer(server, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin, corsOrigins)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin ?? "unknown"} is not allowed by CORS.`));
      }
    }
  });

  io.use(async (socket, next) => {
    try {
      const userId = await authService.authenticate(tokenFromHandshake(socket));
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string | undefined;
    if (userId) {
      socket.join("authenticated");
      socket.join(`user:${userId}`);
    }
  });

  const emitToUsers = (userIds: string[], event: string, payload: unknown) => {
    for (const userId of new Set(userIds)) {
      io.to(`user:${userId}`).emit(event, payload);
    }
  };

  return {
    emitLeaderboard: (userIds, contestId, leaderboard) => {
      emitToUsers(userIds, "contest:leaderboard", { contestId, leaderboard });
    },
    emitLeagueActivity: (userIds, leagueId, message) => {
      emitToUsers(userIds, "league:activity", { leagueId, message, timestamp: new Date().toISOString() });
    },
    emitUserRefresh: (userIds, reason) => {
      emitToUsers(userIds, "user:refresh", { reason, timestamp: new Date().toISOString() });
    },
    emitAuctionRoomsRefresh: () => {
      io.to("authenticated").emit("auction:rooms", {
        timestamp: new Date().toISOString()
      });
    }
  };
}
