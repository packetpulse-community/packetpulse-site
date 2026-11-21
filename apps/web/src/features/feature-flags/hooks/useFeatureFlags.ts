"use client";

import { useQuery } from "@tanstack/react-query";
import type { FeatureFlagKey } from "@packetpulse/types";
import { featureFlagsApi } from "../api/feature-flags.api";

export const FEATURE_FLAGS_QUERY_KEY = ["feature-flags", "public"] as const;

/**
 * Public feature switches. While loading, or if the request fails, a feature counts as ON:
 * the server still enforces every switch, so failing open here only means a member may see
 * a button that then answers "this feature is off", never the other way round.
 */
export function useFeatureFlags() {
  const query = useQuery({
    queryKey: FEATURE_FLAGS_QUERY_KEY,
    queryFn: featureFlagsApi.getPublic,
    staleTime: 15_000,
    retry: 1,
  });
  return {
    isLoading: query.isPending,
    isError: query.isError,
    isEnabled: (key: FeatureFlagKey) => query.data?.flags[key] !== false,
  };
}

export function useFeatureFlag(key: FeatureFlagKey) {
  const { isEnabled, isLoading } = useFeatureFlags();
  return { enabled: isEnabled(key), isLoading };
}
