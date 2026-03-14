import { Queue } from "bullmq";

import type { Env } from "./env.js";

export interface JobManager {
  enqueueProviderSync: () => Promise<void>;
  enqueueLeaderboardRefresh: (contestId: string) => Promise<void>;
}

export function createJobManager(env: Env): JobManager {
  if (!env.REDIS_URL) {
    return {
      enqueueProviderSync: async () => undefined,
      enqueueLeaderboardRefresh: async () => undefined
    };
  }

  const redisUrl = new URL(env.REDIS_URL);
  const connection = {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    tls: redisUrl.protocol === "rediss:" ? {}
      : undefined
  };

  const providerQueue = new Queue("provider-sync", { connection });
  const leaderboardQueue = new Queue("leaderboard-refresh", { connection });

  return {
    enqueueProviderSync: async () => {
      await providerQueue.add("sync", {});
    },
    enqueueLeaderboardRefresh: async (contestId: string) => {
      await leaderboardQueue.add("refresh", { contestId });
    }
  };
}
