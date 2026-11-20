import { AsyncLocalStorage } from "node:async_hooks";

// Per-request accumulator for the Server-Timing header (TASK-005 measurement). Holds only
// numbers: how many database queries ran and how long they took. Never SQL, parameters or ids.
export interface ServerTimingStore {
  dbMs: number;
  queries: number;
}

const storage = new AsyncLocalStorage<ServerTimingStore>();

export const serverTimingContext = {
  run<T>(store: ServerTimingStore, fn: () => T): T {
    return storage.run(store, fn);
  },
  // Called from the Prisma query event; a no-op outside a request (jobs, startup).
  recordQuery(durationMs: number) {
    const store = storage.getStore();
    if (!store) return;
    store.queries += 1;
    store.dbMs += durationMs;
  },
};

// SERVER_TIMING=true|false wins; unset means on everywhere except production.
export function isServerTimingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.SERVER_TIMING?.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return env.NODE_ENV !== "production";
}

export function formatServerTiming(store: ServerTimingStore, totalMs: number): string {
  const n = store.queries;
  return `db;dur=${store.dbMs.toFixed(1)};desc="${n} ${n === 1 ? "query" : "queries"}", app;dur=${totalMs.toFixed(1)}`;
}
