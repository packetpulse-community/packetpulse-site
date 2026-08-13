// Next.js instrumentation hook — runs once when the server starts, before any route
// handler. Mirrors the backend's main.ts tracing-first requirement (see plan §6).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
