import { apiFetchClient } from "@/shared/api/http-client";
import type { CreateClientLogDto } from "@packetpulse/types";

// Fire-and-forget — a logging call must never throw or block the caller.
export function logClientEvent(dto: CreateClientLogDto) {
  apiFetchClient("/logs", { method: "POST", body: JSON.stringify(dto) }).catch(() => {});
}
