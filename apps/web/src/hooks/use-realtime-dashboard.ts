import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";

import type { AuctionRoomDetails } from "@fantasy-cricket/types";

import { writeAuctionRoomToCache } from "../lib/auction-query-cache";

export function useRealtimeDashboard(
  apiUrl: string,
  sessionToken: string | null,
  queryClient: QueryClient
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current?.close();
    socketRef.current = null;

    if (!sessionToken) {
      return;
    }

    const socket = io(apiUrl, {
      auth: { token: sessionToken },
      transports: ["websocket"],
      upgrade: false,
      reconnectionAttempts: 5,
      timeout: 10_000
    });

    const invalidatePageQueries = () => {
      queryClient.invalidateQueries({ queryKey: ["home"] });
      queryClient.invalidateQueries({ queryKey: ["contests"] });
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    };

    socket.on("contest:leaderboard", () => {
      invalidatePageQueries();
    });
    socket.on("league:activity", () => {
      invalidatePageQueries();
      queryClient.invalidateQueries({ queryKey: ["auction-room"] });
    });
    socket.on("user:refresh", () => {
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      invalidatePageQueries();
      queryClient.invalidateQueries({ queryKey: ["auction-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["auction-room"] });
    });
    socket.on("auction:room", (room: AuctionRoomDetails) => {
      writeAuctionRoomToCache(queryClient, room);
    });
    socket.on("auction:rooms", () => {
      queryClient.invalidateQueries({ queryKey: ["auction-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["auction-room"] });
    });

    socketRef.current = socket;

    return () => {
      socket.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [apiUrl, queryClient, sessionToken]);
}
