import type { QueryClient } from "@tanstack/react-query";

import type { AuctionRoomDetails, AuctionRoomSummary } from "@fantasy-cricket/types";

function isNewerSummary(next: AuctionRoomSummary, current?: AuctionRoomSummary) {
  if (!current) {
    return true;
  }

  return next.updatedAt >= current.updatedAt;
}

function upsertAuctionRoomSummary(
  summaries: AuctionRoomSummary[] | undefined,
  summary: AuctionRoomSummary
) {
  const next = [...(summaries ?? [])];
  const existingIndex = next.findIndex((item) => item.id === summary.id);

  if (existingIndex >= 0) {
    if (isNewerSummary(summary, next[existingIndex])) {
      next[existingIndex] = summary;
    }
    return next;
  }

  return [summary, ...next];
}

export function writeAuctionRoomToCache(queryClient: QueryClient, room: AuctionRoomDetails) {
  queryClient.setQueryData<AuctionRoomDetails | undefined>(["auction-room", room.room.id], (current) => {
    if (current && room.room.updatedAt < current.room.updatedAt) {
      return current;
    }
    return room;
  });
  queryClient.setQueryData<AuctionRoomSummary[] | undefined>(["auction-rooms"], (current) =>
    upsertAuctionRoomSummary(current, room.room)
  );
}

export function updateAuctionRoomInCache(
  queryClient: QueryClient,
  roomId: string,
  updater: (room: AuctionRoomDetails) => AuctionRoomDetails
) {
  queryClient.setQueryData<AuctionRoomDetails | undefined>(["auction-room", roomId], (current) => {
    if (!current) {
      return current;
    }

    const next = updater(current);
    next.room.updatedAt = new Date().toISOString();
    queryClient.setQueryData<AuctionRoomSummary[] | undefined>(["auction-rooms"], (rooms) =>
      upsertAuctionRoomSummary(rooms, next.room)
    );
    return next;
  });
}
