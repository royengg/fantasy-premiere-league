import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@fantasy-cricket/types": path.resolve(root, "../../packages/types/src/index.ts"),
      "@fantasy-cricket/api-client": path.resolve(root, "../../packages/api-client/src/index.ts"),
      "@fantasy-cricket/domain": path.resolve(root, "../../packages/domain/src/index.ts"),
      "@": path.resolve(root, "./src")
    }
  },
  server: {
    port: 5173
  }
});
