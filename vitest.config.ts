import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@fantasy-cricket/types": path.resolve(root, "packages/types/src/index.ts"),
      "@fantasy-cricket/validators": path.resolve(root, "packages/validators/src/index.ts"),
      "@fantasy-cricket/domain": path.resolve(root, "packages/domain/src/index.ts"),
      "@fantasy-cricket/scoring": path.resolve(root, "packages/scoring/src/index.ts"),
      "@fantasy-cricket/api-client": path.resolve(root, "packages/api-client/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});

