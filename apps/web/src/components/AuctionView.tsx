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
import { AuctionLiveTable } from "./auction/AuctionLiveTable";
import { AuctionRoomLobby } from "./auction/AuctionRoomLobby";
import { formatCrores, formatBidToken, nameInitials, timeLeftLabel, isApiError } from "./auction/utils";

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

// Utility functions are now in ./auction/utils.ts

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

  const liveAuctionTable = room && roomOnly ? (
    <AuctionLiveTable
      room={room}
      currentUserId={currentUserId}
      currentSeat={currentSeat}
      clockNow={clockNow}
      isCurrentUserLeading={isCurrentUserLeading}
      minimumQuickBidLakhs={minimumQuickBidLakhs}
      quickBidChoices={quickBidChoices}
      bidMutation={bidMutation}
      withdrawMutation={withdrawMutation}
      skipMutation={skipMutation}
    />
  ) : null;

  const roomPanel = selectedRoomQuery.isLoading ? (
    <div className="card p-6 text-text-muted">Loading room...</div>
  ) : room ? (
    roomOnly ? (
      liveAuctionTable
    ) : (
      <AuctionRoomLobby
        room={room}
        currentUserId={currentUserId}
        currentSeat={currentSeat}
        clockNow={clockNow}
        joinRoomMutation={joinRoomMutation}
        readyMutation={readyMutation}
        bidMutation={bidMutation}
        withdrawMutation={withdrawMutation}
        skipMutation={skipMutation}
        quickBidChoices={quickBidChoices}
      />
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
