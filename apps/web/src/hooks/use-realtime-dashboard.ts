import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";

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
      reconnectionAttempts: 5,
      timeout: 10_000
    });

    socket.on("contest:leaderboard", () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    });
    socket.on("league:activity", () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    });
    socket.on("user:refresh", () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
