import { z } from "zod";

export const NetworkToolTypeSchema = z.enum(["ping", "traceroute", "dns", "port-scan"]);

export const RunNetworkToolSchema = z.object({
  toolType: NetworkToolTypeSchema,
  target: z
    .string()
    .min(1)
    .max(253)
    .regex(/^[a-zA-Z0-9.-]+$/, "target must be a hostname or IP address"),
});
export type RunNetworkToolDto = z.infer<typeof RunNetworkToolSchema>;
