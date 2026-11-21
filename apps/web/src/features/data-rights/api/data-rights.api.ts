import type { AdminDataRequestView, DataExportLink, DataRequestView, DataRightsOverview, RequestErasureDto } from "@packetpulse/types";
import { apiFetchClient } from "@/shared/api/http-client";

interface Page<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// SCR-038 (TASK-046). Every call works on the signed-in member's own data.
export const dataRightsApi = {
  overview: () => apiFetchClient<DataRightsOverview>("/data-rights"),
  requestExport: () => apiFetchClient<DataRequestView>("/data-rights/export", { method: "POST" }),
  exportLink: () => apiFetchClient<DataExportLink>("/data-rights/export/link", { method: "POST" }),
  discardExport: () => apiFetchClient<{ success: boolean }>("/data-rights/export", { method: "DELETE" }),
  requestErasure: (dto: RequestErasureDto) =>
    apiFetchClient<DataRequestView>("/data-rights/erasure", { method: "POST", body: JSON.stringify(dto) }),
  cancelErasure: () => apiFetchClient<{ success: boolean }>("/data-rights/erasure", { method: "DELETE" }),
  adminList: (scope: "open" | "all") => apiFetchClient<Page<AdminDataRequestView>>(`/admin/data-requests?scope=${scope}&limit=50`),
};

export const dataRightsKeys = {
  overview: ["data-rights", "overview"] as const,
  admin: (scope: "open" | "all") => ["admin", "data-requests", scope] as const,
};
