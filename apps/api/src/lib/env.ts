import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCorsOrigins } from "./cors.js";

export interface Env {
  PORT: number;
  CORS_ORIGIN: string;
  CORS_ALLOWED_ORIGINS: string[];
  DATABASE_URL: string;
  DIRECT_URL: string;
  CRICKET_DATA_API_KEY: string;
  CRICKET_DATA_BASE_URL: string;
  CRICKET_DATA_CACHE_TTL: number;
  CRICKET_DATA_DAILY_LIMIT: number;
}

const envDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(envDirectory, "../../../../");
const rootEnvPath = path.join(projectRoot, ".env");
const apiEnvPath = path.join(projectRoot, "apps/api/.env");

let envLoaded = false;

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFile(filePath: string, shellKeys: Set<string>) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim());

    if (shellKeys.has(key)) {
      continue;
    }

    process.env[key] = value;
  }
}

export function loadEnvFiles() {
  if (envLoaded) {
    return;
  }

  const shellKeys = new Set(Object.keys(process.env));
  loadEnvFile(rootEnvPath, shellKeys);
  loadEnvFile(apiEnvPath, shellKeys);
  envLoaded = true;
}

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Required environment variable ${name} is not set. ` +
      `Copy .env.example to .env and fill in the required values.`
    );
  }
  return value;
}

export function loadEnv(): Env {
  loadEnvFiles();

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

  return {
    PORT: Number(process.env.PORT ?? 4000),
    CORS_ORIGIN: corsOrigin,
    CORS_ALLOWED_ORIGINS: resolveCorsOrigins(corsOrigin),
    DATABASE_URL: requireEnvVar("DATABASE_URL"),
    DIRECT_URL: process.env.DIRECT_URL ?? requireEnvVar("DATABASE_URL"),
    CRICKET_DATA_API_KEY: process.env.CRICKET_DATA_API_KEY ?? "",
    CRICKET_DATA_BASE_URL: process.env.CRICKET_DATA_BASE_URL ?? "https://api.cricapi.com/v1",
    CRICKET_DATA_CACHE_TTL: Number(process.env.CRICKET_DATA_CACHE_TTL ?? 300),
    CRICKET_DATA_DAILY_LIMIT: Number(process.env.CRICKET_DATA_DAILY_LIMIT ?? 80)
  };
}

// Lazy singleton to avoid import-time side effects (#18)
let cachedEnv: Env | null = null;
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = loadEnv();
  }
  return cachedEnv;
}
