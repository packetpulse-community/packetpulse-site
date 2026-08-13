import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INTERNAL_API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this monorepo — a sibling checkout with its own
  // lockfile at /home/hackycoder/mca_labs otherwise confuses Next's auto-detection.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async rewrites() {
    // Proxies browser-originated /api/* calls to the backend so they're same-origin
    // from the browser's perspective — the backend's Set-Cookie for the httpOnly
    // auth cookies then lands on this app's own origin, which is what lets
    // Server Components' cookies() see them. Server-side (SSR) calls skip this
    // proxy entirely and hit the backend directly (see shared/api/http-client.ts).
    return [{ source: "/api/:path*", destination: `${INTERNAL_API_URL}/api/:path*` }];
  },
};

export default nextConfig;
