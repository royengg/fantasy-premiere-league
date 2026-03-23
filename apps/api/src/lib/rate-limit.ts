import type { RequestHandler } from "express";

interface FixedWindowRateLimiterOptions {
  windowMs: number;
  max: number;
  message: string;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

export function createFixedWindowRateLimiter({
  windowMs,
  max,
  message
}: FixedWindowRateLimiterOptions): RequestHandler {
  const buckets = new Map<string, WindowEntry>();

  // Periodically prune expired entries to prevent unbounded memory growth (#2)
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, 60_000);
  pruneInterval.unref?.();

  return (req, res, next) => {
    const key = `${req.ip ?? "unknown"}:${req.path}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      next();
      return;
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      res.status(429).json({
        message,
        code: "RATE_LIMITED"
      });
      return;
    }

    current.count += 1;
    next();
  };
}
