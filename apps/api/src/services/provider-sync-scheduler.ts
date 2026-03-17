import type { AppStore } from "../data/store.js";
import type { Env } from "../lib/env.js";
import type { AppRepository } from "../repositories/app-repository.js";
import { isProviderManagedId } from "./provider-sync-service.js";
import type { GameService } from "./game-service.js";

const IST_TIME_ZONE = "Asia/Kolkata";
const SCHEDULER_POLL_INTERVAL_MS = 1000 * 60 * 30;
const UPCOMING_REFRESH_WINDOW_MS = 1000 * 60 * 60 * 24 * 3;
const DAILY_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24;
const MATCH_DAY_SYNC_LEAD_MS = 1000 * 60 * 60 * 6;
const PRE_MATCH_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 6;
const FAILED_SYNC_RETRY_COOLDOWN_MS = 1000 * 60 * 90;

function istDayKey(timestamp: string | number | Date) {
  const date = new Date(timestamp);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function nextUpcomingProviderMatch(store: AppStore) {
  const now = Date.now();

  return store.matches
    .filter(
      (match) =>
        isProviderManagedId(match.id) &&
        match.state === "scheduled" &&
        new Date(match.startsAt).getTime() > now
    )
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
    )[0];
}

function hasProviderFeed(store: AppStore) {
  return (
    store.matches.some((match) => isProviderManagedId(match.id)) &&
    store.contests.some((contest) => contest.kind === "public" && isProviderManagedId(contest.id)) &&
    store.players.some((player) => isProviderManagedId(player.id))
  );
}

export class ProviderSyncScheduler {
  private intervalId?: ReturnType<typeof setInterval>;
  private syncInFlight: Promise<void> | null = null;

  constructor(
    private readonly env: Env,
    private readonly repository: AppRepository,
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

    const store = await this.repository.loadStore();
    if (!this.shouldSync(store, trigger)) {
      return;
    }

    const attemptAt = new Date().toISOString();
    const previousStatus = store.provider.status;
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

  private shouldSync(store: AppStore, trigger: "startup" | "interval") {
    const now = Date.now();
    const lastAttemptedAt = new Date(store.provider.lastAttemptedAt).getTime();
    const lastSyncedAt = new Date(store.provider.syncedAt).getTime();

    if (
      store.provider.status !== "ready" &&
      Number.isFinite(lastAttemptedAt) &&
      now - lastAttemptedAt < FAILED_SYNC_RETRY_COOLDOWN_MS
    ) {
      return false;
    }

    if (!hasProviderFeed(store)) {
      return true;
    }

    const nextMatch = nextUpcomingProviderMatch(store);
    if (!nextMatch) {
      return false;
    }

    const nextMatchStart = new Date(nextMatch.startsAt).getTime();
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
