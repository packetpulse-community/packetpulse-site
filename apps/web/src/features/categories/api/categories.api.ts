import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { Category, CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto } from "@packetpulse/types";

export type { Category };

export const categoriesServerApi = {
  list: (cookieHeader = "") => apiFetch<Category[]>("/categories", { cookieHeader }),
};

export const categoriesClientApi = {
  list: () => apiFetchClient<Category[]>("/categories"),
  create: (dto: CreateCategoryDto) => apiFetchClient<Category>("/categories", { method: "POST", body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateCategoryDto) =>
    apiFetchClient<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  delete: (id: string) => apiFetchClient<{ success: boolean }>(`/categories/${id}`, { method: "DELETE" }),
  reorder: (dto: ReorderCategoriesDto) =>
    apiFetchClient<Category[]>("/categories/reorder", { method: "PUT", body: JSON.stringify(dto) }),
};
