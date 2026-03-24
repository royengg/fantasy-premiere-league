import { Clock3, Gavel, Users, Vote, Wallet, SkipForward } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { AuctionRoomDetails, AuctionParticipant } from "@fantasy-cricket/types";
import { formatCrores, timeLeftLabel } from "./utils";

interface AuctionRoomLobbyProps {
  room: AuctionRoomDetails;
  currentUserId: string;
  currentSeat: AuctionParticipant | undefined;
  clockNow: number;
  joinRoomMutation: UseMutationResult<any, any, { roomId?: string; inviteCode?: string }, any>;
  readyMutation: UseMutationResult<any, any, boolean, any>;
  bidMutation: UseMutationResult<any, any, { poolEntryId: string; amountLakhs: number }, any>;
  withdrawMutation: UseMutationResult<any, any, string, any>;
  skipMutation: UseMutationResult<any, any, string, any>;
  quickBidChoices: { amountLakhs: number; incrementLakhs: number; disabled: boolean }[];
}

export function AuctionRoomLobby({
  room,
  currentUserId,
  currentSeat,
  clockNow,
  joinRoomMutation,
  readyMutation,
  bidMutation,
  withdrawMutation,
  skipMutation,
  quickBidChoices
}: AuctionRoomLobbyProps) {
  return (
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
  );
}
