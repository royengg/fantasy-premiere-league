import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  Gavel,
  LoaderCircle,
  Search,
  Settings2,
  SkipForward,
  Users,
  Vote,
  Wallet
} from "lucide-react";

import { ApiError, createApiClient } from "@fantasy-cricket/api-client";
import { canAffordAuctionBid, nextAuctionBidAmount } from "@fantasy-cricket/domain";
import type {
  AuctionCatalogPlayer,
  AuctionRoomDetails,
  League
} from "@fantasy-cricket/types";

import {
  updateAuctionRoomInCache,
  writeAuctionRoomToCache
} from "../lib/auction-query-cache";

type ApiClient = ReturnType<typeof createApiClient>;

interface AuctionViewProps {
  api: ApiClient;
  currentUserId: string;
  league?: League;
  fixedRoomId?: string;
  roomOnly?: boolean;
}

interface AuctionFormState {
  name: string;
  visibility: "public" | "private";
  maxParticipants: number;
  squadSize: number;
  bidWindowSeconds: number;
  bidExtensionSeconds: number;
  playerPoolMode: "all" | "custom";
  playerPoolPlayerIds: string[];
}

const DEFAULT_FORM_STATE: AuctionFormState = {
  name: "",
  visibility: "private",
  maxParticipants: 10,
  squadSize: 13,
  bidWindowSeconds: 30,
  bidExtensionSeconds: 5,
  playerPoolMode: "all",
  playerPoolPlayerIds: []
};

function formatCrores(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)}Cr`;
}

function formatBidToken(lakhs: number) {
  if (lakhs >= 100) {
    return `₹${(lakhs / 100).toFixed(lakhs % 100 === 0 ? 0 : 2)}Cr`;
  }

  return `₹${lakhs}L`;
}

function nameInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function timeLeftLabel(endsAt?: string, nowMs = Date.now()) {
  if (!endsAt) {
    return "Waiting";
  }
  const remainingMs = Math.max(0, new Date(endsAt).getTime() - nowMs);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  return `${totalSeconds}s`;
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function selectedCatalogPlayers(
  catalog: AuctionCatalogPlayer[],
  ids: string[]
) {
  const selected = new Set(ids);
  return catalog.filter((player) => selected.has(player.playerId));
}

function activeRoomRefetchInterval(room: AuctionRoomDetails | undefined) {
  if (!room) {
    return false;
  }

  return room.room.state === "waiting" || room.room.state === "live"
    ? 1000
    : false;
}

function optimisticBidEndsAt(room: AuctionRoomDetails, nowMs: number) {
  const currentEndsAtMs = room.currentLot?.lotEndsAt
    ? new Date(room.currentLot.lotEndsAt).getTime()
    : nowMs;
  return new Date(
    Math.max(nowMs, currentEndsAtMs) + room.settings.bidExtensionSeconds * 1000
  ).toISOString();
}

export function AuctionView({
  api,
  currentUserId,
  league,
  fixedRoomId,
  roomOnly = false
}: AuctionViewProps) {
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(fixedRoomId ?? null);
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [formState, setFormState] = useState<AuctionFormState>(DEFAULT_FORM_STATE);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockNow(Date.now());
    }, 250);
    return () => window.clearInterval(interval);
  }, []);

  const roomsQuery = useQuery({
    queryKey: ["auction-rooms"],
    queryFn: () => api.getAuctionRooms(),
    enabled: !roomOnly,
    refetchInterval: roomOnly ? false : 2000,
    refetchIntervalInBackground: true
  });

  const leagueRooms = useMemo(() => {
    const rooms = roomsQuery.data ?? [];
    if (!league) {
      return rooms;
    }

    return rooms.filter((room) => room.leagueId === league.id);
  }, [league, roomsQuery.data]);

  const catalogQuery = useQuery({
    queryKey: ["auction-catalog"],
    queryFn: () => api.getAuctionCatalogPlayers()
  });

  const selectedRoomQuery = useQuery({
    queryKey: ["auction-room", selectedRoomId],
    queryFn: () => api.getAuctionRoom(selectedRoomId!),
    enabled: Boolean(selectedRoomId),
    refetchInterval: ({ state }) =>
      activeRoomRefetchInterval(state.data as AuctionRoomDetails | undefined),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  useEffect(() => {
    if (!fixedRoomId) {
      return;
    }

    setSelectedRoomId((current) => (current === fixedRoomId ? current : fixedRoomId));
  }, [fixedRoomId]);

  useEffect(() => {
    if (roomOnly) {
      return;
    }

    if (!leagueRooms.length) {
      setSelectedRoomId(null);
      return;
    }

    if (!selectedRoomId || !leagueRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(leagueRooms[0].id);
    }
  }, [leagueRooms, roomOnly, selectedRoomId]);

  useEffect(() => {
    if (!league) {
      return;
    }

    setFormState((current) => ({
      ...current,
      name: current.name || `${league.name} Auction`,
      visibility: league.visibility,
      maxParticipants: Math.min(current.maxParticipants, league.maxMembers),
      squadSize: league.squadSize
    }));
  }, [league]);

  useEffect(() => {
    const room = selectedRoomQuery.data;
    if (!room || room.room.hostUserId !== currentUserId || room.room.state !== "waiting") {
      return;
    }

    setFormState({
      name: room.room.name,
      visibility: room.room.visibility,
      maxParticipants: room.settings.maxParticipants,
      squadSize: room.settings.squadSize,
      bidWindowSeconds: room.settings.bidWindowSeconds,
      bidExtensionSeconds: room.settings.bidExtensionSeconds,
      playerPoolMode: room.settings.playerPoolMode,
      playerPoolPlayerIds: room.selectedPlayerIds
    });
  }, [currentUserId, selectedRoomQuery.data]);

  const createRoomMutation = useMutation({
    mutationFn: () =>
      api.createAuctionRoom({
        ...formState,
        leagueId: league?.id,
        visibility: league?.visibility ?? formState.visibility,
        maxParticipants: league
          ? Math.min(formState.maxParticipants, league.maxMembers)
          : formState.maxParticipants,
        squadSize: league?.squadSize ?? formState.squadSize
      }),
    onSuccess: (room) => {
      setStatus({ ok: true, message: "Auction room created." });
      setSelectedRoomId(room.room.id);
      writeAuctionRoomToCache(queryClient, room);
    },
    onError: (error) =>
      setStatus({
        ok: false,
        message: isApiError(error) ? error.message : "Could not create auction room."
      })
  });

  const updateRoomMutation = useMutation({
    mutationFn: () =>
      api.updateAuctionRoomSettings(selectedRoomId!, {
        name: formState.name,
        maxParticipants: formState.maxParticipants,
        squadSize: formState.squadSize,
        bidWindowSeconds: formState.bidWindowSeconds,
        bidExtensionSeconds: formState.bidExtensionSeconds,
        playerPoolMode: formState.playerPoolMode,
        playerPoolPlayerIds: formState.playerPoolPlayerIds
      }),
    onSuccess: (room) => {
      setStatus({ ok: true, message: "Auction room updated." });
      writeAuctionRoomToCache(queryClient, room);
    },
    onError: (error) =>
      setStatus({
        ok: false,
        message: isApiError(error) ? error.message : "Could not update auction room."
      })
  });

  const joinRoomMutation = useMutation({
    mutationFn: (payload: { roomId?: string; inviteCode?: string }) => api.joinAuctionRoom(payload),
    onSuccess: (room) => {
      setStatus({ ok: true, message: "Joined auction room." });
      setSelectedRoomId(room.room.id);
      setJoinInviteCode("");
      writeAuctionRoomToCache(queryClient, room);
    },
    onError: (error) =>
      setStatus({
        ok: false,
        message: isApiError(error) ? error.message : "Could not join auction room."
      })
  });

  const readyMutation = useMutation({
    mutationFn: (ready: boolean) => api.setAuctionReady(selectedRoomId!, ready),
    onMutate: async (ready) => {
      if (!selectedRoomId) {
        return { previousRoom: undefined as AuctionRoomDetails | undefined };
      }

      await queryClient.cancelQueries({ queryKey: ["auction-room", selectedRoomId] });
      const previousRoom = queryClient.getQueryData<AuctionRoomDetails>([
        "auction-room",
        selectedRoomId
      ]);

      updateAuctionRoomInCache(queryClient, selectedRoomId, (room) => ({
        ...room,
        participants: room.participants.map((participant) =>
          participant.userId === currentUserId
            ? { ...participant, ready }
            : participant
        )
      }));

      return { previousRoom };
    },
    onSuccess: (room) => {
      writeAuctionRoomToCache(queryClient, room);
    },
    onError: (error, _ready, context) => {
      if (selectedRoomId && context?.previousRoom) {
        queryClient.setQueryData(["auction-room", selectedRoomId], context.previousRoom);
      }
      setStatus({
        ok: false,
        message: isApiError(error) ? error.message : "Could not update ready state."
      });
    }
  });

  const bidMutation = useMutation({
    mutationFn: (payload: { poolEntryId: string; amountLakhs: number }) =>
      api.placeAuctionBid(selectedRoomId!, payload.poolEntryId, payload.amountLakhs),
    onMutate: async ({ amountLakhs, poolEntryId }) => {
      if (!selectedRoomId) {
        return { previousRoom: undefined as AuctionRoomDetails | undefined };
      }

      await queryClient.cancelQueries({ queryKey: ["auction-room", selectedRoomId] });
      const previousRoom = queryClient.getQueryData<AuctionRoomDetails>([
        "auction-room",
        selectedRoomId
      ]);

      if (
        previousRoom?.currentLot &&
        previousRoom.room.state === "live" &&
        previousRoom.currentLot.poolEntryId === poolEntryId
      ) {
        const actingParticipant = previousRoom.participants.find(
          (participant) => participant.userId === currentUserId
        );
        const optimisticCreatedAt = new Date().toISOString();

        updateAuctionRoomInCache(queryClient, selectedRoomId, (room) => ({
          ...room,
          currentLot: room.currentLot
            ? {
                ...room.currentLot,
                currentBidLakhs: amountLakhs,
                currentLeaderUserId: currentUserId,
                currentLeaderDisplayName:
                  actingParticipant?.displayName ?? room.currentLot.currentLeaderDisplayName,
                lotEndsAt: optimisticBidEndsAt(room, Date.now())
              }
            : room.currentLot,
          skipVoteUserIds: room.skipVoteUserIds.filter((userId) => userId !== currentUserId),
          withdrawnUserIds: room.withdrawnUserIds.filter((userId) => userId !== currentUserId),
          recentBids: room.currentLot
            ? [
                {
                  id: `optimistic-bid-${currentUserId}-${optimisticCreatedAt}`,
                  roomId: room.room.id,
                  poolEntryId: room.currentLot.poolEntryId,
                  userId: currentUserId,
                  displayName: actingParticipant?.displayName ?? "You",
                  amountLakhs,
                  createdAt: optimisticCreatedAt
                },
                ...room.recentBids.filter(
                  (bid) =>
                    !(
                      bid.userId === currentUserId &&
                      bid.poolEntryId === room.currentLot?.poolEntryId &&
                      bid.amountLakhs === amountLakhs
                    )
                )
              ].slice(0, 12)
            : room.recentBids,
          eventLog: room.currentLot
            ? [
                ...room.eventLog,
                {
                  id: `optimistic-event-${currentUserId}-${optimisticCreatedAt}`,
                  type: "bid-placed" as const,
                  actorUserId: currentUserId,
                  message: `${actingParticipant?.displayName ?? "You"} bid ${formatBidToken(amountLakhs)}.`,
                  createdAt: optimisticCreatedAt
                }
              ].slice(-20)
            : room.eventLog
        }));
      }

      return { previousRoom };
    },
    onSuccess: (room) => {
      writeAuctionRoomToCache(queryClient, room);
    },
    onError: (error, _amountLakhs, context) => {
      if (selectedRoomId && context?.previousRoom) {
        queryClient.setQueryData(["auction-room", selectedRoomId], context.previousRoom);
      }
      setStatus({
        ok: false,
        message: isApiError(error) ? error.message : "Could not place bid."
      });
    }
  });

  const withdrawMutation = useMutation({
    mutationFn: (poolEntryId: string) => api.withdrawAuctionBid(selectedRoomId!, poolEntryId),
    onMutate: async (poolEntryId) => {
      if (!selectedRoomId) {
        return { previousRoom: undefined as AuctionRoomDetails | undefined };
      }

      await queryClient.cancelQueries({ queryKey: ["auction-room", selectedRoomId] });
      const previousRoom = queryClient.getQueryData<AuctionRoomDetails>([
        "auction-room",
        selectedRoomId
      ]);

      updateAuctionRoomInCache(queryClient, selectedRoomId, (room) => {
        if (room.currentLot?.poolEntryId !== poolEntryId) {
          return room;
        }

        return {
          ...room,
          skipVoteUserIds: room.skipVoteUserIds.filter((userId) => userId !== currentUserId),
          withdrawnUserIds: room.withdrawnUserIds.includes(currentUserId)
            ? room.withdrawnUserIds
            : [...room.withdrawnUserIds, currentUserId]
        };
      });

      return { previousRoom };
    },
    onSuccess: (room) => {
      writeAuctionRoomToCache(queryClient, room);
    },
    onError: (error, _vars, context) => {
      if (selectedRoomId && context?.previousRoom) {
        queryClient.setQueryData(["auction-room", selectedRoomId], context.previousRoom);
      }
      setStatus({
        ok: false,
        message: isApiError(error) ? error.message : "Could not withdraw."
      });
    }
  });

  const skipMutation = useMutation({
    mutationFn: (poolEntryId: string) => api.skipAuctionLot(selectedRoomId!, poolEntryId),
    onMutate: async (poolEntryId) => {
      if (!selectedRoomId) {
        return { previousRoom: undefined as AuctionRoomDetails | undefined };
      }

      await queryClient.cancelQueries({ queryKey: ["auction-room", selectedRoomId] });
      const previousRoom = queryClient.getQueryData<AuctionRoomDetails>([
        "auction-room",
        selectedRoomId
      ]);

      updateAuctionRoomInCache(queryClient, selectedRoomId, (room) => {
        if (room.currentLot?.poolEntryId !== poolEntryId) {
          return room;
        }

        return {
          ...room,
          withdrawnUserIds: room.withdrawnUserIds.filter((userId) => userId !== currentUserId),
          skipVoteUserIds: room.skipVoteUserIds.includes(currentUserId)
            ? room.skipVoteUserIds
            : [...room.skipVoteUserIds, currentUserId]
        };
      });

      return { previousRoom };
    },
    onSuccess: (room) => {
      writeAuctionRoomToCache(queryClient, room);
    },
    onError: (error, _vars, context) => {
      if (selectedRoomId && context?.previousRoom) {
        queryClient.setQueryData(["auction-room", selectedRoomId], context.previousRoom);
      }
      setStatus({
        ok: false,
        message: isApiError(error) ? error.message : "Could not vote to skip."
      });
    }
  });

  const room = selectedRoomQuery.data;
  const currentSeat = room?.participants.find((participant) => participant.userId === currentUserId);
  const isHost = room?.room.hostUserId === currentUserId;
  const canEditWaitingRoom = Boolean(room && isHost && room.room.state === "waiting");
  const effectiveVisibility = league?.visibility ?? formState.visibility;
  const effectiveSquadSize = league?.squadSize ?? formState.squadSize;
  const maxParticipantsLimit = league?.maxMembers ?? 15;

  const filteredCatalog = useMemo(() => {
    const catalog = catalogQuery.data ?? [];
    const query = catalogSearch.trim().toLowerCase();
    if (!query) {
      return catalog.slice(0, 120);
    }

    return catalog
      .filter((player) =>
        [
          player.name,
          player.teamName,
          player.teamShortName,
          player.role
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 120);
  }, [catalogQuery.data, catalogSearch]);

  const selectedPlayers = useMemo(
    () => selectedCatalogPlayers(catalogQuery.data ?? [], formState.playerPoolPlayerIds),
    [catalogQuery.data, formState.playerPoolPlayerIds]
  );

  const toggleCustomPlayer = (playerId: string) => {
    setFormState((current) => ({
      ...current,
      playerPoolPlayerIds: current.playerPoolPlayerIds.includes(playerId)
        ? current.playerPoolPlayerIds.filter((id) => id !== playerId)
        : [...current.playerPoolPlayerIds, playerId]
    }));
  };

  const currentBidLakhs = room?.currentLot?.currentBidLakhs ?? 0;
  const currentUserRoster = room?.rosters.find((roster) => roster.userId === currentUserId);
  const currentUserPurchasedCount =
    room && currentSeat ? room.settings.squadSize - currentSeat.slotsRemaining : 0;
  const isCurrentUserLeading = room?.currentLot?.currentLeaderUserId === currentUserId;
  const minimumQuickBidLakhs = room?.currentLot
    ? nextAuctionBidAmount(
        room.settings.basePriceLakhs,
        room.currentLot.currentBidLakhs ?? undefined
      )
    : null;
  const quickBidChoices =
    room?.currentLot && currentSeat
      ? [25, 50, 100].map((incrementLakhs) => {
          const currentLot = room.currentLot!;
          const amountLakhs = currentBidLakhs + incrementLakhs;
          const blockedByOverseas =
            currentLot.nationality === "overseas" &&
            currentSeat.overseasCount >= room.settings.maxOverseas;
          const affordable = canAffordAuctionBid(
            currentSeat.purseRemainingLakhs,
            currentSeat.slotsRemaining,
            amountLakhs,
            room.settings.basePriceLakhs
          );

          return {
            incrementLakhs,
            amountLakhs,
            disabled:
              room.room.state !== "live" ||
              currentLot.currentLeaderUserId === currentUserId ||
              currentSeat.slotsRemaining <= 0 ||
              blockedByOverseas ||
              !affordable ||
              (minimumQuickBidLakhs !== null && amountLakhs < minimumQuickBidLakhs)
          };
        })
      : [];

  const liveAuctionTable =
    room && roomOnly ? (
      <div className="-mx-4 pb-[calc(15rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:pb-[calc(14rem+env(safe-area-inset-bottom))] lg:-mx-8 lg:pb-56">
        <div className="border-y border-border bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.14),transparent_36%),linear-gradient(180deg,#0d1012_0%,#060709_100%)] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <div className="mx-auto max-w-[1560px]">
            <div className="mb-5 flex flex-col gap-4 border-b border-white/6 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-2 font-semibold text-accent">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                  Auction Table
                </span>
                <span className="text-text-muted">
                  Lot {room.currentLot?.nominationOrder ?? room.totalPoolCount - room.pendingPlayerCount} / {room.totalPoolCount}
                </span>
                <span className="text-text-muted">
                  {room.room.participantCount}/{room.room.maxParticipants} managers
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-border bg-surface-card/80 px-4 py-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">
                    Timer
                  </div>
                  <div className="mt-1 text-xl font-black text-accent">
                    {room.currentLot
                      ? timeLeftLabel(room.currentLot.lotEndsAt, clockNow)
                      : "Waiting"}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-surface-card/80 px-4 py-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">
                    Room
                  </div>
                  <div className="mt-1 text-base font-bold">
                    {room.room.leagueName ?? room.room.name}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="min-w-0">
                <div className="rounded-[2rem] border border-accent/12 bg-[linear-gradient(180deg,rgba(11,20,14,0.9),rgba(8,10,11,0.98))] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.5)] sm:p-6">
                  {room.currentLot ? (
                    <div className="mx-auto flex max-w-4xl flex-col gap-8">
                      <div className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-accent/14 bg-black/25 px-5 py-6 sm:px-8">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-3xl font-black tracking-tight text-text-muted">
                            {nameInitials(room.currentLot.playerName)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-3xl font-black tracking-tight sm:text-4xl">
                              {room.currentLot.playerName}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                              <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-accent">
                                {room.currentLot.role}
                              </span>
                              <span>{room.currentLot.teamShortName}</span>
                              <span className="text-white/20">•</span>
                              <span>{room.currentLot.nationality}</span>
                            </div>
                            <div className="mt-4 border-t border-white/8 pt-4 text-sm tracking-[0.18em] text-text-muted uppercase">
                              Base Price{" "}
                              <span className="font-black tracking-normal text-accent">
                                {formatBidToken(room.currentLot.openingBidLakhs)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-accent/14 bg-black/25 px-5 py-7 text-center sm:px-8">
                        <div className="flex items-center justify-between text-sm uppercase tracking-[0.18em] text-text-muted">
                          <span>Current Bid</span>
                          <span>Base: {formatBidToken(room.currentLot.openingBidLakhs)}</span>
                        </div>
                        <div className="mt-6 text-6xl font-black tracking-tight text-accent sm:text-7xl">
                          {formatBidToken(
                            room.currentLot.currentBidLakhs ?? room.currentLot.openingBidLakhs
                          )}
                        </div>
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-text-muted">
                            {room.currentLot.currentLeaderDisplayName ?? "No bids yet"}
                          </span>
                          <span
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${
                              isCurrentUserLeading
                                ? "border border-emerald-400/30 bg-emerald-500/12 text-emerald-300"
                                : "border border-white/10 bg-white/[0.03] text-text-muted"
                            }`}
                          >
                            {isCurrentUserLeading ? "You are leading" : "Bid to lead"}
                          </span>
                        </div>
                      </div>

                      <div className="mx-auto w-full max-w-3xl">
                        <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.02] px-5 py-4">
                          {room.eventLog.length ? (
                            <div className="text-sm text-text-muted">
                              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-accent" />
                              {room.eventLog[room.eventLog.length - 1]?.message}
                            </div>
                          ) : (
                            <div className="text-sm text-text-muted">
                              Waiting for the next auction action.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[1.75rem] border border-white/8 bg-black/20 p-10 text-center text-text-muted">
                      {room.room.state === "completed"
                        ? "Auction completed."
                        : "Preparing the next player..."}
                    </div>
                  )}
                </div>
              </section>

              <aside className="xl:sticky xl:top-6">
                <div className="space-y-4 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto xl:pr-1">
                <div className="rounded-[1.75rem] border border-accent/12 bg-[linear-gradient(180deg,rgba(12,18,14,0.94),rgba(8,10,11,0.98))] p-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-muted">
                    Your Purse
                  </div>
                  <div className="mt-3 text-4xl font-black tracking-tight text-accent">
                    {currentSeat
                      ? formatCrores(currentSeat.purseRemainingLakhs)
                      : formatCrores(room.settings.purseLakhs)}
                  </div>
                  <div className="mt-2 text-sm text-text-muted">
                    {currentSeat
                      ? `${currentUserPurchasedCount} of ${room.settings.squadSize} slots filled`
                      : "Spectating this auction"}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-accent/12 bg-[linear-gradient(180deg,rgba(12,18,14,0.94),rgba(8,10,11,0.98))] p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-text-muted">
                      Teams
                    </h3>
                    <span className="text-xs text-text-muted">
                      {room.room.participantCount} managers
                    </span>
                  </div>
                  <div className="space-y-2">
                    {room.participants.map((participant) => {
                      const roster = room.rosters.find(
                        (entry) => entry.userId === participant.userId
                      );
                      const isCurrentUser = participant.userId === currentUserId;
                      const isLeader =
                        participant.userId === room.currentLot?.currentLeaderUserId;

                      return (
                        <div
                          key={participant.userId}
                          className={`rounded-2xl border px-4 py-3 ${
                            isCurrentUser
                              ? "border-accent/40 bg-accent/10"
                              : "border-white/8 bg-white/[0.02]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-lg font-semibold">
                                {participant.displayName}
                                {isCurrentUser ? " (you)" : ""}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-sm text-text-muted">
                                <span>{formatCrores(participant.purseRemainingLakhs)}</span>
                                <span>
                                  {roster?.players.length ?? 0}/{room.settings.squadSize}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                              {isLeader ? "Leading" : participant.isHost ? "Host" : "In"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/8 bg-black/20 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Vote className="h-4 w-4 text-accent" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-text-muted">
                      Bid Feed
                    </h3>
                  </div>
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {room.recentBids.length ? (
                      room.recentBids.map((bid) => (
                        <div
                          key={bid.id}
                          className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm"
                        >
                          <span className="font-semibold">{bid.displayName}</span>{" "}
                          bid{" "}
                          <span className="font-bold text-accent">
                            {formatBidToken(bid.amountLakhs)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-text-muted">
                        No bids yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/8 bg-black/20 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-accent" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-text-muted">
                      Room Activity
                    </h3>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {room.eventLog.length ? (
                      room.eventLog.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3"
                        >
                          <div className="text-sm font-medium">{event.message}</div>
                          <div className="mt-1 text-xs text-text-muted">
                            {new Date(event.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-text-muted">
                        No activity yet.
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.2rem)] z-30 lg:bottom-0 lg:left-64">
          <div className="mx-auto max-w-[1560px] px-3 pb-3 sm:px-6 lg:px-8 lg:pb-4">
            <div className="rounded-[1.9rem] border border-accent/15 bg-[linear-gradient(180deg,rgba(15,21,17,0.96),rgba(10,12,12,0.98))] p-3 shadow-[0_-18px_50px_rgba(0,0,0,0.45)] backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3 px-2">
                <div className="text-sm text-text-muted">
                  {isCurrentUserLeading
                    ? "You’re leading"
                    : currentSeat
                      ? `Need at least ${minimumQuickBidLakhs ? formatBidToken(minimumQuickBidLakhs) : formatBidToken(room.settings.basePriceLakhs)}`
                      : "Join the room to bid"}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span>{room.skipVoteUserIds.length} skip votes</span>
                  <span>•</span>
                  <span>{room.withdrawnUserIds.length} withdrawn</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_220px_180px]">
                {quickBidChoices.map((choice) => (
                  <button
                    key={choice.incrementLakhs}
                    type="button"
                    className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-5 text-center text-lg font-black tracking-tight text-text transition-colors hover:border-accent/35 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={bidMutation.isPending || choice.disabled}
                    onClick={() =>
                      room.currentLot
                        ? void bidMutation.mutateAsync({
                            poolEntryId: room.currentLot.poolEntryId,
                            amountLakhs: choice.amountLakhs
                          })
                        : undefined
                    }
                  >
                    {choice.incrementLakhs === 100 ? "+₹1Cr" : `+₹${choice.incrementLakhs}L`}
                  </button>
                ))}

                <button
                  type="button"
                  className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-5 text-center text-lg font-black tracking-tight text-text transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={
                    withdrawMutation.isPending ||
                    !room.currentLot ||
                    room.currentLot.currentLeaderUserId === currentUserId
                  }
                  onClick={() =>
                    room.currentLot
                      ? void withdrawMutation.mutateAsync(room.currentLot.poolEntryId)
                      : undefined
                  }
                >
                  Withdraw
                </button>

                <button
                  type="button"
                  className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-5 text-center text-lg font-black tracking-tight text-text transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={
                    skipMutation.isPending ||
                    !room.currentLot ||
                    Boolean(room.currentLot.currentBidLakhs)
                  }
                  onClick={() =>
                    room.currentLot
                      ? void skipMutation.mutateAsync(room.currentLot.poolEntryId)
                      : undefined
                  }
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  const roomPanel = selectedRoomQuery.isLoading ? (
    <div className="card p-6 text-text-muted">Loading room...</div>
  ) : room ? (
    roomOnly ? (
      liveAuctionTable
    ) : (
      <>
        <div className="card p-4 sm:p-6 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Gavel className="h-5 w-5 text-accent" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent">
                  {room.room.leagueName ? "League Auction Room" : "Live Auction Room"}
                </span>
              </div>
              <h3 className="text-xl font-bold sm:text-2xl">{room.room.name}</h3>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-text-muted">
                <span>{room.room.hostDisplayName} hosts</span>
                <span>
                  {room.room.participantCount}/{room.room.maxParticipants} participants
                </span>
                <span>{room.settings.squadSize} player squads</span>
                <span>{formatCrores(room.settings.purseLakhs)} purse</span>
              </div>
              {room.room.inviteCode ? (
                <div className="mt-3 text-xs font-semibold text-accent">
                  Invite code: {room.room.inviteCode}
                </div>
              ) : null}
            </div>

            {room.room.state === "waiting" && !currentSeat ? (
              <button
                type="button"
                className="btn-primary"
                disabled={joinRoomMutation.isPending}
                onClick={() => void joinRoomMutation.mutateAsync({ roomId: room.room.id })}
              >
                Join Room
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="stat-block">
              <Users className="mb-1 h-4 w-4 text-accent" />
              <span className="stat-value">{room.room.participantCount}</span>
              <span className="stat-label">Participants</span>
            </div>
            <div className="stat-block">
              <Wallet className="mb-1 h-4 w-4 text-accent" />
              <span className="stat-value">{formatCrores(room.settings.purseLakhs)}</span>
              <span className="stat-label">Starting Purse</span>
            </div>
            <div className="stat-block">
              <Clock3 className="mb-1 h-4 w-4 text-accent" />
              <span className="stat-value">{room.settings.bidWindowSeconds}s</span>
              <span className="stat-label">Bid Timer</span>
            </div>
            <div className="stat-block">
              <Vote className="mb-1 h-4 w-4 text-accent" />
              <span className="stat-value">{room.pendingPlayerCount}</span>
              <span className="stat-label">Pending Lots</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr,0.9fr]">
          <div className="space-y-6">
            <div className="card space-y-4 p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="font-bold">Current Lot</h4>
                <span className="badge">{room.room.state}</span>
              </div>

              {room.currentLot ? (
                <>
                  <div className="rounded-2xl border border-accent/25 bg-accent/10 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-wide text-accent">
                          {room.currentLot.teamShortName} • {room.currentLot.role}
                        </div>
                        <div className="mt-1 text-2xl font-black sm:text-3xl">
                          {room.currentLot.playerName}
                        </div>
                        <div className="mt-1 text-sm text-text-muted">
                          {room.currentLot.teamName} • {room.currentLot.nationality}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold uppercase tracking-wide text-text-muted">
                          {room.room.state === "live" ? "Timer" : "Status"}
                        </div>
                        <div className="text-xl font-black text-accent sm:text-2xl">
                          {timeLeftLabel(room.currentLot.lotEndsAt, clockNow)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-text-muted">
                          Current Bid
                        </div>
                        <div className="text-2xl font-bold">
                          {formatCrores(
                            room.currentLot.currentBidLakhs ??
                              room.currentLot.openingBidLakhs
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-text-muted">
                          Leader
                        </div>
                        <div className="text-2xl font-bold">
                          {room.currentLot.currentLeaderDisplayName ?? "No bids yet"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {currentSeat && room.room.state === "live" && room.currentLot ? (
                    (() => {
                      const currentLot = room.currentLot;
                      return (
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      {quickBidChoices.map((choice) => (
                        <button
                          key={choice.incrementLakhs}
                          type="button"
                          className="btn-primary"
                          disabled={bidMutation.isPending || choice.disabled}
                          onClick={() =>
                            void bidMutation.mutateAsync({
                              poolEntryId: currentLot.poolEntryId,
                              amountLakhs: choice.amountLakhs
                            })
                          }
                        >
                          Bid{" "}
                          {choice.incrementLakhs === 100
                            ? "+1Cr"
                            : `+${choice.incrementLakhs}L`}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={
                          withdrawMutation.isPending ||
                          currentLot.currentLeaderUserId === currentUserId
                        }
                        onClick={() => void withdrawMutation.mutateAsync(currentLot.poolEntryId)}
                      >
                        Withdraw
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={
                          skipMutation.isPending || Boolean(currentLot.currentBidLakhs)
                        }
                        onClick={() => void skipMutation.mutateAsync(currentLot.poolEntryId)}
                      >
                        <SkipForward className="h-4 w-4" />
                        Skip Vote
                      </button>
                    </div>
                      );
                    })()
                  ) : null}

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="badge">Skip votes: {room.skipVoteUserIds.length}</span>
                    <span className="badge">Withdrawn: {room.withdrawnUserIds.length}</span>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-border p-5 text-text-muted">
                  {room.room.state === "completed"
                    ? "Auction completed."
                    : room.room.state === "waiting"
                      ? "Waiting for all managers to ready up."
                      : "Preparing the next player..."}
                </div>
              )}
            </div>

            <div className="card space-y-4 p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="font-bold">Participants</h4>
                {room.room.state === "waiting" && currentSeat ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void readyMutation.mutateAsync(!currentSeat.ready)}
                  >
                    {currentSeat.ready ? "Unready" : "Ready Up"}
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {room.participants.map((participant) => (
                  <div
                    key={participant.userId}
                    className="rounded-2xl border border-border bg-surface-elevated p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">
                          {participant.displayName} {participant.isHost ? "• Host" : ""}
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          {formatCrores(participant.purseRemainingLakhs)} left •{" "}
                          {participant.slotsRemaining} slots
                        </div>
                      </div>
                      <span
                        className={`badge ${
                          participant.ready ? "bg-accent/15 text-accent" : ""
                        }`}
                      >
                        {room.room.state === "waiting"
                          ? participant.ready
                            ? "ready"
                            : "waiting"
                          : `OS ${participant.overseasCount}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card space-y-4 p-4 sm:p-6">
              <h4 className="font-bold">Squads & Purse</h4>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {room.rosters.map((roster) => (
                  <div
                    key={roster.userId}
                    className="rounded-2xl border border-border bg-surface-elevated p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{roster.displayName}</div>
                      <div className="text-xs text-text-muted">
                        {formatCrores(roster.purseRemainingLakhs)} left
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      {roster.players.length}/{room.settings.squadSize} players • spent{" "}
                      {formatCrores(roster.totalSpentLakhs)}
                    </div>
                    <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                      {roster.players.length ? (
                        roster.players.map((player) => (
                          <div
                            key={player.playerId}
                            className="flex items-center justify-between rounded-xl bg-surface p-2 text-sm"
                          >
                            <div>
                              <div className="font-medium">{player.playerName}</div>
                              <div className="text-xs text-text-muted">
                                {player.teamShortName} • {player.role}
                              </div>
                            </div>
                            <div className="font-semibold">
                              {formatCrores(player.priceLakhs)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-text-muted">
                          No players bought yet.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card space-y-4 p-4 sm:p-6">
              <h4 className="font-bold">Recent Bids</h4>
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {room.recentBids.length ? (
                  room.recentBids.map((bid) => (
                    <div
                      key={bid.id}
                      className="rounded-xl border border-border bg-surface-elevated p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{bid.displayName}</div>
                        <div className="font-bold text-accent">
                          {formatCrores(bid.amountLakhs)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {new Date(bid.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-text-muted">No bids yet.</div>
                )}
              </div>
            </div>

            <div className="card space-y-4 p-4 sm:p-6">
              <h4 className="font-bold">Room Activity</h4>
              <div className="max-h-96 space-y-3 overflow-y-auto">
                {room.eventLog.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-border bg-surface-elevated p-3"
                  >
                    <div className="text-sm font-medium">{event.message}</div>
                    <div className="mt-1 text-xs text-text-muted">
                      {new Date(event.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    )
  ) : (
    <div className="card p-6 text-text-muted">Pick an auction room to continue.</div>
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {!roomOnly ? (
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Gavel className="w-5 h-5 text-accent" />
          <span className="text-xs font-bold uppercase tracking-widest text-accent">
            {league ? "League Auction" : "Auction Room"}
          </span>
        </div>
        <h2 className="text-xl font-bold sm:text-2xl">
          {league ? `${league.name} auction` : "IPL-style live auction rooms"}
        </h2>
        <p className="text-text-muted text-sm mt-1">
          {league
            ? `Run the season-opening auction for ${league.name}. Squads are fixed at ${league.squadSize} players with ₹100 Cr purses and ₹25L base prices.`
            : "Build squads in real time with a shared purse, timed bids, skip votes, and host-controlled player pools."}
        </p>
      </div>
      ) : null}

      {roomOnly ? (
        <div className="space-y-6">{roomPanel}</div>
      ) : (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px,1fr]">
        <div className="space-y-6">
          <div className="card p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-accent" />
              <h3 className="font-bold">
                {canEditWaitingRoom
                  ? league
                    ? "Edit League Auction"
                    : "Edit Auction Room"
                  : league
                    ? "Create League Auction"
                    : "Create Auction Room"}
              </h3>
            </div>

            <div className="space-y-3">
              <input
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                placeholder={league ? `${league.name} Auction` : "Weekend Auction Club"}
                className="w-full h-11 px-3 bg-surface border border-border rounded-xl text-sm focus:border-accent outline-none"
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-text-muted">Visibility</span>
                  <input
                    value={effectiveVisibility === "public" ? "Public season league" : "Private friend league"}
                    readOnly
                    className="w-full h-11 px-3 bg-surface border border-border rounded-xl text-sm text-text-muted"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-text-muted">Squad Size</span>
                  <input
                    value={`${effectiveSquadSize} players`}
                    readOnly
                    className="w-full h-11 px-3 bg-surface border border-border rounded-xl text-sm text-text-muted"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="text-text-muted">Seats</span>
                  <input
                    type="number"
                    min={2}
                    max={maxParticipantsLimit}
                    value={formState.maxParticipants}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        maxParticipants: Math.min(Number(event.target.value || 2), maxParticipantsLimit)
                      }))
                    }
                    className="w-full h-11 px-3 bg-surface border border-border rounded-xl focus:border-accent outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-text-muted">Bid Timer</span>
                  <input
                    type="number"
                    min={8}
                    max={60}
                    value={formState.bidWindowSeconds}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        bidWindowSeconds: Number(event.target.value || 30)
                      }))
                    }
                    className="w-full h-11 px-3 bg-surface border border-border rounded-xl focus:border-accent outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-text-muted">Extend</span>
                  <input
                    type="number"
                    min={2}
                    max={15}
                    value={formState.bidExtensionSeconds}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        bidExtensionSeconds: Number(event.target.value || 2)
                      }))
                    }
                    className="w-full h-11 px-3 bg-surface border border-border rounded-xl focus:border-accent outline-none"
                  />
                </label>
              </div>

              <label className="space-y-1 text-sm">
                <span className="text-text-muted">Player Pool</span>
                <select
                  value={formState.playerPoolMode}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      playerPoolMode: event.target.value as "all" | "custom"
                    }))
                  }
                  className="w-full h-11 px-3 bg-surface border border-border rounded-xl focus:border-accent outline-none"
                >
                  <option value="all">Use all available players</option>
                  <option value="custom">Custom shortlist</option>
                </select>
              </label>

              {formState.playerPoolMode === "custom" ? (
                <div className="space-y-3 rounded-xl border border-border p-3 bg-surface-elevated">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      value={catalogSearch}
                      onChange={(event) => setCatalogSearch(event.target.value)}
                      placeholder="Search players"
                      className="w-full h-10 pl-9 pr-3 bg-surface border border-border rounded-xl text-sm focus:border-accent outline-none"
                    />
                  </div>
                  <div className="text-xs text-text-muted">
                    Selected {formState.playerPoolPlayerIds.length} players
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredCatalog.map((player) => {
                      const selected = formState.playerPoolPlayerIds.includes(player.playerId);
                      return (
                        <button
                          key={player.playerId}
                          type="button"
                          onClick={() => toggleCustomPlayer(player.playerId)}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${
                            selected
                              ? "border-accent bg-accent/10"
                              : "border-border bg-surface hover:border-accent/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-semibold">{player.name}</div>
                              <div className="text-xs text-text-muted">
                                {player.teamShortName} • {player.role} • {player.nationality}
                              </div>
                            </div>
                            <div className="text-xs text-text-muted">Rt {player.rating}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedPlayers.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedPlayers.slice(0, 12).map((player) => (
                        <span key={player.playerId} className="badge">
                          {player.name}
                        </span>
                      ))}
                      {selectedPlayers.length > 12 ? (
                        <span className="badge">+{selectedPlayers.length - 12} more</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setStatus(null);
                  if (canEditWaitingRoom && selectedRoomId) {
                    void updateRoomMutation.mutateAsync();
                    return;
                  }
                  void createRoomMutation.mutateAsync();
                }}
                disabled={createRoomMutation.isPending || updateRoomMutation.isPending || !formState.name.trim()}
                className="btn-primary w-full"
              >
                {createRoomMutation.isPending || updateRoomMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                ) : canEditWaitingRoom ? (
                  league ? "Update League Auction" : "Update Auction Room"
                ) : (
                  league ? "Create League Auction" : "Create Auction Room"
                )}
              </button>
            </div>
          </div>

          {!league ? (
            <div className="card p-4 sm:p-5 space-y-4">
              <h3 className="font-bold">Join with Invite</h3>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={joinInviteCode}
                  onChange={(event) => setJoinInviteCode(event.target.value.toUpperCase())}
                  placeholder="Invite code"
                  className="flex-1 h-11 px-3 bg-surface border border-border rounded-xl text-sm font-mono uppercase tracking-wide focus:border-accent outline-none"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!joinInviteCode || joinRoomMutation.isPending}
                  onClick={() => void joinRoomMutation.mutateAsync({ inviteCode: joinInviteCode })}
                >
                  Join
                </button>
              </div>
            </div>
          ) : null}

          <div className="card p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{league ? "League Auctions" : "Open Rooms"}</h3>
              <span className="text-xs text-text-muted">{leagueRooms.length} rooms</span>
            </div>

            <div className="space-y-3">
              {roomsQuery.isLoading ? (
                <div className="text-sm text-text-muted">Loading auction rooms...</div>
              ) : leagueRooms.length ? (
                leagueRooms.map((auctionRoom) => (
                  <button
                    key={auctionRoom.id}
                    type="button"
                    onClick={() => setSelectedRoomId(auctionRoom.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      auctionRoom.id === selectedRoomId
                        ? "border-accent bg-accent/10"
                        : "border-border bg-surface-elevated hover:border-accent/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{auctionRoom.name}</div>
                        <div className="text-xs text-text-muted mt-1">
                          {auctionRoom.hostDisplayName} • {auctionRoom.participantCount}/{auctionRoom.maxParticipants} seats
                        </div>
                      </div>
                      <span className="badge">{auctionRoom.state}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
                      <span>{auctionRoom.squadSize} players</span>
                      <span>{auctionRoom.bidWindowSeconds}s timer</span>
                      <span>{auctionRoom.visibility}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-text-muted">
                  {league ? "No auction room has been created for this league yet." : "No auction rooms yet."}
                </div>
              )}
            </div>
          </div>

          {status ? (
            <div
              className={`rounded-xl border p-3 text-sm ${
                status.ok
                  ? "border-accent/20 bg-accent/10 text-accent"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {status.message}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">{roomPanel}</div>
      </div>
      )}
    </div>
  );
}
