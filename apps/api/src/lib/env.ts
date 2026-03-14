export interface Env {
  PORT: number;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  DIRECT_URL: string;
  REDIS_URL: string;
  PROVIDER_API_KEY: string;
}

export function loadEnv(): Env {
  return {
    PORT: Number(process.env.PORT ?? 4000),
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://USER:PASSWORD@ep-example-pooler.us-east-1.aws.neon.tech/fantasy_cricket?sslmode=require&pgbouncer=true&connect_timeout=15",
    DIRECT_URL:
      process.env.DIRECT_URL ??
      "postgresql://USER:PASSWORD@ep-example.us-east-1.aws.neon.tech/fantasy_cricket?sslmode=require&connect_timeout=15",
    REDIS_URL: process.env.REDIS_URL ?? "",
    PROVIDER_API_KEY: process.env.PROVIDER_API_KEY ?? "demo-provider-key"
  };
}
