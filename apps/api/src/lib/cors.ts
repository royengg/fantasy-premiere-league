import type { CorsOptions } from "cors";

const DEFAULT_LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
] as const;

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

function isLocalOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function resolveCorsOrigins(configuredOrigins: string) {
  const parsedOrigins = configuredOrigins
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter((origin) => origin.length > 0);

  const allowedOrigins = new Set(parsedOrigins.length > 0 ? parsedOrigins : [DEFAULT_LOCAL_ORIGINS[0]]);

  if (parsedOrigins.length === 0 || parsedOrigins.every(isLocalOrigin)) {
    for (const origin of DEFAULT_LOCAL_ORIGINS) {
      allowedOrigins.add(origin);
    }
  }

  return [...allowedOrigins];
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: readonly string[]) {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(normalizeOrigin(origin));
}

export function createCorsOptions(allowedOrigins: readonly string[]): CorsOptions {
  return {
    origin(origin, callback) {
      if (isAllowedOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin ?? "unknown"} is not allowed by CORS.`));
    }
  };
}
