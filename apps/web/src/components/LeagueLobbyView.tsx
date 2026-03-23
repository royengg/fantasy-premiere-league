import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Share2,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

import { ApiError, createApiClient } from "@fantasy-cricket/api-client";
import type { League } from "@fantasy-cricket/types";

import { AuctionView } from "./AuctionView";

type ApiClient = ReturnType<typeof createApiClient>;

interface LeagueLobbyViewProps {
  api: ApiClient;
  currentUserId: string;
  league: League;
  onBack: () => void;
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function formatSeats(current: number, max: number) {
  return `${current}/${max}`;
}

export function LeagueLobbyView({
  api,
  currentUserId,
  league,
  onBack,
}: LeagueLobbyViewProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const roomsQuery = useQuery({
    queryKey: ["auction-rooms"],
    queryFn: () => api.getAuctionRooms(),
  });

  const roomSummary = useMemo(
    () => (roomsQuery.data ?? []).find((room) => room.leagueId === league.id),
    [league.id, roomsQuery.data],
  );

  const roomQuery = useQuery({
    queryKey: ["auction-room", roomSummary?.id],
    queryFn: () => api.getAuctionRoom(roomSummary!.id),
    enabled: Boolean(roomSummary?.id),
  });

  const createRoomMutation = useMutation({
    mutationFn: () =>
      api.createAuctionRoom({
        leagueId: league.id,
        name: `${league.name} Auction`,
        visibility: league.visibility,
        maxParticipants: league.maxMembers,
        squadSize: league.squadSize,
        bidWindowSeconds: 12,
        bidExtensionSeconds: 5,
        playerPoolMode: "all",
      }),
    onSuccess: async (room) => {
      setStatus("League lobby created.");
      await queryClient.invalidateQueries({ queryKey: ["auction-rooms"] });
      await queryClient.invalidateQueries({
        queryKey: ["auction-room", room.room.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
    },
    onError: (error) => {
      setStatus(
        isApiError(error)
          ? error.message
          : "Could not create the league lobby.",
      );
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: (roomId: string) => api.joinAuctionRoom({ roomId }),
    onSuccess: async (room) => {
      setStatus("Joined the league lobby.");
      await queryClient.invalidateQueries({
        queryKey: ["auction-room", room.room.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["auction-rooms"] });
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
    },
    onError: (error) => {
      setStatus(
        isApiError(error) ? error.message : "Could not join the league lobby.",
      );
    },
  });

  const readyMutation = useMutation({
    mutationFn: (ready: boolean) => api.setAuctionReady(roomSummary!.id, ready),
    onSuccess: async (room) => {
      await queryClient.invalidateQueries({
        queryKey: ["auction-room", room.room.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["auction-rooms"] });
    },
    onError: (error) => {
      setStatus(
        isApiError(error) ? error.message : "Could not update ready state.",
      );
    },
  });

  const deleteLeagueMutation = useMutation({
    mutationFn: () => api.deleteLeague(league.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      await queryClient.invalidateQueries({ queryKey: ["auction-rooms"] });
      if (roomSummary?.id) {
        await queryClient.invalidateQueries({
          queryKey: ["auction-room", roomSummary.id],
        });
      }
      onBack();
    },
    onError: (error) => {
      setStatus(isApiError(error) ? error.message : "Could not delete league.");
    },
  });

  useEffect(() => {
    if (roomsQuery.isLoading || roomSummary || createRoomMutation.isPending) {
      return;
    }

    if (league.createdBy !== currentUserId) {
      return;
    }

    void createRoomMutation.mutateAsync();
  }, [
    createRoomMutation,
    currentUserId,
    league.createdBy,
    roomSummary,
    roomsQuery.isLoading,
  ]);

  useEffect(() => {
    const room = roomQuery.data;
    if (!room || room.room.state !== "waiting") {
      return;
    }

    const isParticipant = room.participants.some(
      (participant) => participant.userId === currentUserId,
    );
    if (isParticipant || joinRoomMutation.isPending) {
      return;
    }

    void joinRoomMutation.mutateAsync(room.room.id);
  }, [currentUserId, joinRoomMutation, roomQuery.data]);

  const currentSeat = roomQuery.data?.participants.find(
    (participant) => participant.userId === currentUserId,
  );
  const readyCount =
    roomQuery.data?.participants.filter((participant) => participant.ready)
      .length ?? 0;
  const slots = Array.from({ length: league.maxMembers }, (_, index) => {
    const participant = roomQuery.data?.participants[index];
    return participant ?? null;
  });

  const copyInviteCode = async () => {
    await navigator.clipboard.writeText(league.inviteCode);
    setStatus("Invite code copied.");
  };

  const shareInvite = async () => {
    const shareMessage = `${league.name} league code: ${league.inviteCode}`;
    if (navigator.share) {
      await navigator.share({
        title: league.name,
        text: shareMessage,
      });
      return;
    }

    await navigator.clipboard.writeText(shareMessage);
    setStatus("Invite details copied.");
  };

  const canDeleteLeague = league.createdBy === currentUserId;

  const deleteLeague = async () => {
    const confirmed = window.confirm(
      `Delete "${league.name}"? This removes the league, its lobby, and its invite code.`,
    );

    if (!confirmed) {
      return;
    }

    setStatus(null);
    await deleteLeagueMutation.mutateAsync();
  };

  if (roomQuery.data?.room.state && roomQuery.data.room.state !== "waiting") {
    return (
      <AuctionView
        api={api}
        currentUserId={currentUserId}
        league={league}
        fixedRoomId={roomQuery.data.room.id}
        roomOnly
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-accent"
          >
            Back to leagues
          </button>

          {canDeleteLeague ? (
            <button
              type="button"
              onClick={() => void deleteLeague()}
              disabled={deleteLeagueMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {deleteLeagueMutation.isPending ? "Deleting..." : "Delete league"}
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              <span className="text-xs font-bold uppercase tracking-widest text-accent">
                League Lobby
              </span>
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">{league.name}</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-muted">
              Invite managers, fill the party slots, and ready up. The auction
              starts automatically as soon as every joined manager is ready.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <LobbyMetric
              label="Managers"
              value={formatSeats(
                roomQuery.data?.participants.length ?? 0,
                league.maxMembers,
              )}
            />
            <LobbyMetric label="Ready" value={`${readyCount}`} />
            <LobbyMetric label="Team Size" value={`${league.squadSize}`} />
          </div>
        </div>
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:gap-5 sm:pb-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg font-bold">Waiting Lobby</h3>
              <div className="badge">
                <Users className="mr-1 h-3 w-3" />
                {formatSeats(
                  roomQuery.data?.participants.length ?? 0,
                  league.maxMembers,
                )}
              </div>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Invite managers, fill the open slots, and ready up. The auction
              starts automatically when every joined manager is ready.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
                  Party Code
                </div>
                <div className="mt-1 text-2xl font-black tracking-[0.18em] sm:text-[1.85rem]">
                  {league.inviteCode}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text-muted">
                {readyCount} of {roomQuery.data?.participants.length ?? 0} joined
                manager
                {readyCount === 1 ? "" : "s"} ready
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:w-[30rem]">
            <button
              type="button"
              onClick={() => void copyInviteCode()}
              className="btn-secondary w-full"
            >
              <Copy className="h-4 w-4" />
              Copy code
            </button>
            <button
              type="button"
              onClick={() => void shareInvite()}
              className="btn-secondary w-full"
            >
              <Share2 className="h-4 w-4" />
              Share invite
            </button>
            {currentSeat ? (
              <button
                type="button"
                className="btn-primary w-full"
                disabled={readyMutation.isPending || !roomSummary}
                onClick={() => void readyMutation.mutateAsync(!currentSeat.ready)}
              >
                <CheckCircle2 className="h-4 w-4" />
                {currentSeat.ready ? "Unready" : "Ready Up"}
              </button>
            ) : (
              <div className="rounded-xl border border-border bg-surface-elevated px-4 py-3 text-center text-sm text-text-muted">
                Joining lobby...
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 sm:mt-6">
          {roomsQuery.isLoading ||
          createRoomMutation.isPending ||
          roomQuery.isLoading ? (
            <div className="rounded-2xl border border-border bg-surface-elevated p-8 text-center text-text-muted">
              Setting up the lobby...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {slots.map((participant, index) => (
                <div
                  key={participant?.userId ?? `slot-${index + 1}`}
                  className={`rounded-2xl border p-4 ${
                    participant
                      ? "border-accent/20 bg-accent/10"
                      : "border-dashed border-border bg-surface-elevated"
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">
                    Slot {index + 1}
                  </div>

                  {participant ? (
                    <>
                      <div className="mt-3 text-base font-bold">
                        {participant.displayName}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {participant.isHost ? "Host" : "Manager"}
                      </div>
                      <div className="mt-4">
                        <span
                          className={`badge ${
                            participant.ready ? "bg-accent/15 text-accent" : ""
                          }`}
                        >
                          {participant.ready ? "Ready" : "Waiting"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-6 text-sm text-text-muted">
                      Open slot
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="rounded-2xl border border-border bg-surface-elevated p-4 text-sm text-text-muted">
            <div className="flex items-center gap-2 font-semibold text-text">
              <Clock3 className="h-4 w-4 text-accent" />
              Auto-start rules
            </div>
            <ul className="mt-3 space-y-2 leading-6">
              <li>At least 2 managers must join the lobby.</li>
              <li>Every joined manager must ready up.</li>
              <li>The auction starts automatically when both conditions are met.</li>
            </ul>
          </div>

          {status ? (
            <div className="rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text-muted lg:max-w-sm">
              {status}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function LobbyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-block min-w-[96px]">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
