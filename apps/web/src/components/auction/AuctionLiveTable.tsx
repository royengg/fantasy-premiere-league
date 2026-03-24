import { SkipForward } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { AuctionRoomDetails, AuctionParticipant } from "@fantasy-cricket/types";
import { formatBidToken, formatCrores, nameInitials, timeLeftLabel } from "./utils";

interface AuctionLiveTableProps {
  room: AuctionRoomDetails;
  currentUserId: string;
  currentSeat: AuctionParticipant | undefined;
  clockNow: number;
  isCurrentUserLeading: boolean;
  minimumQuickBidLakhs: number | null;
  quickBidChoices: { amountLakhs: number; incrementLakhs: number; disabled: boolean }[];
  bidMutation: UseMutationResult<any, any, { poolEntryId: string; amountLakhs: number }, any>;
  withdrawMutation: UseMutationResult<any, any, string, any>;
  skipMutation: UseMutationResult<any, any, string, any>;
}

export function AuctionLiveTable({
  room,
  currentUserId,
  currentSeat,
  clockNow,
  isCurrentUserLeading,
  minimumQuickBidLakhs,
  quickBidChoices,
  bidMutation,
  withdrawMutation,
  skipMutation
}: AuctionLiveTableProps) {
  const currentUserPurchasedCount = currentSeat ? room.settings.squadSize - currentSeat.slotsRemaining : 0;

  return (
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
  );
}
