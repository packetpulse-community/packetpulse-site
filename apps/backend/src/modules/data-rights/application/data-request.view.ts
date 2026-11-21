import type { DataRequest } from "@prisma/client";
import type { DataRequestView } from "@packetpulse/types";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toView(r: DataRequest): DataRequestView {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    requestedAt: r.requestedAt.toISOString(),
    scheduledFor: iso(r.scheduledFor),
    readyAt: iso(r.readyAt),
    expiresAt: iso(r.expiresAt),
    completedAt: iso(r.completedAt),
    cancelledAt: iso(r.cancelledAt),
  };
}
