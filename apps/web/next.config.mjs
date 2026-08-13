import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this monorepo — a sibling checkout with its own
  // lockfile at /home/hackycoder/mca_labs otherwise confuses Next's auto-detection.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
