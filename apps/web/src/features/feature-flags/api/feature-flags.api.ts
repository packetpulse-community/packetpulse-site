import { apiFetchClient } from "@/shared/api/http-client";
import type { AdminFeatureFlag, FeatureFlagKey, PublicFeatureFlags } from "@packetpulse/types";

export const featureFlagsApi = {
  /** Public flags only; no sign-in needed. */
  getPublic: () => apiFetchClient<PublicFeatureFlags>("/feature-flags"),
  adminList: () => apiFetchClient<AdminFeatureFlag[]>("/admin/feature-flags"),
  adminUpdate: (key: FeatureFlagKey, dto: { enabled: boolean; reason: string }) =>
    apiFetchClient<AdminFeatureFlag>(`/admin/feature-flags/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify(dto) }),
};
