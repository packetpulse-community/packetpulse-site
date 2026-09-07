import { z } from "zod";
import { PaginationQuerySchema } from "./common";

export const ClientLogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const CreateClientLogSchema = z.object({
  level: ClientLogLevelSchema.default("info"),
  context: z.string().max(200).optional(),
  message: z.string().min(1).max(2000),
  data: z.unknown().optional(),
});
export type CreateClientLogDto = z.infer<typeof CreateClientLogSchema>;

export const ClientLogListQuerySchema = PaginationQuerySchema.extend({
  level: ClientLogLevelSchema.optional(),
  search: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});
export type ClientLogListQuery = z.infer<typeof ClientLogListQuerySchema>;
