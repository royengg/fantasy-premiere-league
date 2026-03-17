import { defineConfig } from "prisma/config";
import { loadEnvFiles } from "./src/lib/env.js";

loadEnvFiles();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DATABASE_URL ??
      process.env.DIRECT_URL ??
      "postgresql://USER:PASSWORD@ep-example.us-east-1.aws.neon.tech/fantasy_cricket?sslmode=require&connect_timeout=15"
  }
});
