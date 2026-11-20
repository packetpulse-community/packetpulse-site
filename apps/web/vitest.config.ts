import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Minimal config: the "@/..." alias used by the app, and the automatic JSX runtime
// so component tests can render with react-dom/server.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
