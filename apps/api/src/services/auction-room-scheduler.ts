import type { RealtimeHub } from "../lib/socket.js";
import type { AuctionService } from "./auction-service.js";

// Use 1s base interval; only the advanceDueRooms query checks for work (#14)
const AUCTION_TICK_INTERVAL_MS = 1000;

export class AuctionRoomScheduler {
  private intervalId?: ReturnType<typeof setInterval>;
  private tickInFlight: Promise<void> | null = null;
  private hasActiveRooms = true; // Assume active on start; first tick will check
  private consecutiveEmptyTicks = 0;
  private static readonly EMPTY_TICK_SLOWDOWN_THRESHOLD = 10;

  constructor(
    private readonly auctionService: AuctionService,
    private readonly realtime: RealtimeHub
  ) {}

  start() {
    this.intervalId = setInterval(() => {
      void this.tick();
    }, AUCTION_TICK_INTERVAL_MS);
    this.intervalId.unref?.();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private async tick() {
    if (this.tickInFlight) {
      await this.tickInFlight;
      return;
    }

    // Skip ticks when no rooms have been active recently (#14)
    if (this.consecutiveEmptyTicks >= AuctionRoomScheduler.EMPTY_TICK_SLOWDOWN_THRESHOLD) {
      // Only check every 10th tick when idle (~10s)
      this.consecutiveEmptyTicks += 1;
      if (this.consecutiveEmptyTicks % 10 !== 0) {
        return;
      }
    }

    this.tickInFlight = (async () => {
      const changedRoomIds = await this.auctionService.advanceDueRooms();
      if (changedRoomIds.length === 0) {
        this.consecutiveEmptyTicks += 1;
        return;
      }

      this.consecutiveEmptyTicks = 0;
      this.realtime.emitAuctionRoomsRefresh();
      for (const roomId of changedRoomIds) {
        const payload = await this.auctionService.getBroadcastRoom(roomId);
        if (payload) {
          this.realtime.emitAuctionRoom(payload.participantIds, payload.room);
        }
      }
    })()
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.warn(
          `Auction scheduler tick failed: ${error instanceof Error ? error.message : "Unknown error."}`
        );
      })
      .finally(() => {
        this.tickInFlight = null;
      });

    await this.tickInFlight;
  }
}
