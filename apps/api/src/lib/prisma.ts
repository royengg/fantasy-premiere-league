import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../generated/prisma/client";
import { loadEnvFiles } from "./env.js";

loadEnvFiles();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://USER:PASSWORD@ep-example-pooler.us-east-1.aws.neon.tech/fantasy_cricket?sslmode=require&connect_timeout=15";

const adapter = new PrismaNeon({
  connectionString
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
