import type { RealtimeHub } from "../lib/socket.js";
import type { AuctionService } from "./auction-service.js";

const AUCTION_TICK_INTERVAL_MS = 1000;

export class AuctionRoomScheduler {
  private intervalId?: ReturnType<typeof setInterval>;
  private tickInFlight: Promise<void> | null = null;

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

    this.tickInFlight = (async () => {
      const changedRoomIds = await this.auctionService.advanceDueRooms();
      if (changedRoomIds.length > 0) {
        this.realtime.emitAuctionRoomsRefresh();
      }
      for (const roomId of changedRoomIds) {
        const participantIds = await this.auctionService.participantIds(roomId);
        if (participantIds.length) {
          this.realtime.emitUserRefresh(participantIds, `auction:${roomId}`);
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
