export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Shared across every list endpoint — pagination is validated once via the Zod
// PaginationQuery DTO (bounded max, plan §3), so this just does the arithmetic.
export function paginate<T>(data: T[], page: number, limit: number, total: number): PaginatedResult<T> {
  return { data, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function prismaSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
