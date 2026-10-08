import { ServiceUnavailableException } from "@nestjs/common";

export const MAINTENANCE_MESSAGE =
  "PacketPulse is undergoing scheduled maintenance. Please check back soon.";

// `maintenance: true` is what the frontend keys on to show the maintenance page,
// so a 503 for any other reason is never mistaken for maintenance.
export function maintenanceException() {
  return new ServiceUnavailableException({ statusCode: 503, message: MAINTENANCE_MESSAGE, maintenance: true });
}
