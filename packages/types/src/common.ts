import { z } from "zod";

// Shared pagination contract — used by every list endpoint. Bounded max prevents
// the old backend's unbounded/broken-limit class of bug (see migration plan §3).
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  });

// One error body for every failed API call (v2 Document 4 §5). `code` is stable and
// safe to switch on; `message` is always a plain human-readable string; `fields` is
// present only for VALIDATION_FAILED, one entry per failing input path.
export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "MAINTENANCE",
  "FEATURE_DISABLED",
  "BAD_REQUEST",
  "PAYLOAD_TOO_LARGE",
  "INTERNAL_ERROR",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorField {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  fields?: ApiErrorField[];
  requestId?: string;
  // Only on the maintenance 503; the web client keys on it to show /maintenance.
  maintenance?: true;
  // Only on FEATURE_DISABLED: the switch that blocked the call.
  feature?: string;
}
