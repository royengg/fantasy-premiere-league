import type { Env } from "../lib/env.js";
import type {
  GameRuntimeRepository,
  ProviderSyncContext
} from "../repositories/runtime-repository.js";
import type { GameService } from "./game-service.js";

const SCHEDULER_POLL_INTERVAL_MS = 1000 * 60 * 30;
const UPCOMING_REFRESH_WINDOW_MS = 1000 * 60 * 60 * 24 * 3;
const DAILY_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24;
const MATCH_DAY_SYNC_LEAD_MS = 1000 * 60 * 60 * 6;
const PRE_MATCH_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 6;
const FAILED_SYNC_RETRY_COOLDOWN_MS = 1000 * 60 * 90;
const MIN_SYNC_REQUEST_BUDGET = 3;

export class ProviderSyncScheduler {
  private intervalId?: ReturnType<typeof setInterval>;
  private syncInFlight: Promise<void> | null = null;

  constructor(
    private readonly env: Env,
    private readonly repository: GameRuntimeRepository,
    private readonly gameService: GameService
  ) {}

  start() {
    if (!this.env.CRICKET_DATA_API_KEY.trim()) {
      return;
    }

    void this.runDueSync("startup");
    this.intervalId = setInterval(() => {
      void this.runDueSync("interval");
    }, SCHEDULER_POLL_INTERVAL_MS);
    this.intervalId.unref?.();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private async runDueSync(trigger: "startup" | "interval") {
    if (this.syncInFlight) {
      await this.syncInFlight;
      return;
    }

    const context = await this.repository.getProviderSyncContext();
    if (!this.shouldSync(context, trigger)) {
      return;
    }

    const attemptAt = new Date().toISOString();
    const previousStatus = context.provider.status;
    await this.repository.updateProviderState({
      status: "syncing",
      lastAttemptedAt: attemptAt
    });
    this.syncInFlight = this.gameService
      .syncProvider()
      .then(() => undefined)
      .catch(async (error) => {
        await this.repository.updateProviderState({
          status: previousStatus,
          lastAttemptedAt: attemptAt
        });
        // eslint-disable-next-line no-console
        console.warn(
          `Scheduled provider sync skipped: ${error instanceof Error ? error.message : "Unknown error."}`
        );
      })
      .finally(() => {
        this.syncInFlight = null;
      });

    await this.syncInFlight;
  }

  private shouldSync(
    context: ProviderSyncContext,
    trigger: "startup" | "interval"
  ) {
    const now = Date.now();
    const lastAttemptedAt = new Date(context.provider.lastAttemptedAt).getTime();
    const lastSyncedAt = new Date(context.provider.syncedAt).getTime();

    if (
      context.provider.blockedUntil &&
      new Date(context.provider.blockedUntil).getTime() > now
    ) {
      return false;
    }

    if (context.remainingDailyRequestBudget < MIN_SYNC_REQUEST_BUDGET) {
      return false;
    }

    if (
      context.provider.status !== "ready" &&
      Number.isFinite(lastAttemptedAt) &&
      now - lastAttemptedAt < FAILED_SYNC_RETRY_COOLDOWN_MS
    ) {
      return false;
    }

    if (!context.hasProviderFeed) {
      return true;
    }

    if (!context.nextUpcomingProviderMatchStartsAt) {
      return false;
    }

    const nextMatchStart = new Date(context.nextUpcomingProviderMatchStartsAt).getTime();
    if (!Number.isFinite(nextMatchStart) || now >= nextMatchStart) {
      return false;
    }

    const lastSyncAge = Number.isFinite(lastSyncedAt) ? now - lastSyncedAt : Number.POSITIVE_INFINITY;
    const timeUntilNextMatch = nextMatchStart - now;
    const withinMatchDayLeadWindow = timeUntilNextMatch <= MATCH_DAY_SYNC_LEAD_MS;
    const withinUpcomingRefreshWindow = timeUntilNextMatch <= UPCOMING_REFRESH_WINDOW_MS;

    if (withinMatchDayLeadWindow) {
      return lastSyncAge >= PRE_MATCH_REFRESH_INTERVAL_MS;
    }

    if (!withinUpcomingRefreshWindow) {
      return false;
    }

    if (trigger === "startup") {
      return lastSyncAge >= DAILY_REFRESH_INTERVAL_MS;
    }

    return lastSyncAge >= DAILY_REFRESH_INTERVAL_MS;
  }
}
