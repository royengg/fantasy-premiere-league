import { Server as HttpServer } from "node:http";

import { Server as SocketServer } from "socket.io";

import type { LeaderboardEntry } from "@fantasy-cricket/types";

export interface RealtimeHub {
  emitLeaderboard: (contestId: string, leaderboard: LeaderboardEntry[]) => void;
  emitLeagueActivity: (leagueId: string, message: string) => void;
}

export function createRealtimeHub(server: HttpServer, corsOrigin: string): RealtimeHub {
  const io = new SocketServer(server, {
    cors: {
      origin: corsOrigin
    }
  });

  return {
    emitLeaderboard: (contestId, leaderboard) => {
      io.to(`contest:${contestId}`).emit("contest:leaderboard", leaderboard);
    },
    emitLeagueActivity: (leagueId, message) => {
      io.to(`league:${leagueId}`).emit("league:activity", { message, timestamp: new Date().toISOString() });
    }
  };
}

