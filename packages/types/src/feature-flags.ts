import { z } from "zod";
import { RequiredReasonSchema } from "./admin";

// Feature switches (TASK-047). The registry itself (defaults, descriptions, who may change a
// flag) lives in the backend; these are the names and wire shapes shared with the web app.
export const FEATURE_FLAG_KEYS = [
  "registration.open",
  "forums.posting",
  "quizzes.attempts",
  "resources.uploads",
  "files.uploads",
  "blogs.comments",
  "notifications.email",
  "onboarding.instant_access",
  "data_rights.export",
  "resumes.upload",
] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

/** Where a flag's current value comes from. */
export type FeatureFlagSource = "default" | "override" | "site_settings";

/** GET /feature-flags: only the flags marked public, as key -> on/off. */
export interface PublicFeatureFlags {
  flags: Partial<Record<FeatureFlagKey, boolean>>;
}

/** GET /admin/feature-flags: one row per flag in the registry. */
export interface AdminFeatureFlag {
  key: FeatureFlagKey;
  description: string;
  defaultValue: boolean;
  enabled: boolean;
  /** True when the current value differs from the default because staff changed it. */
  overridden: boolean;
  /** Exposed to the web app through the public endpoint. */
  public: boolean;
  /** Permission needed to change it. */
  changePermission: string;
  source: FeatureFlagSource;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const UpdateFeatureFlagSchema = z.object({
  enabled: z.boolean(),
  reason: RequiredReasonSchema,
});
export type UpdateFeatureFlagDto = z.infer<typeof UpdateFeatureFlagSchema>;

/** Error body extra for FEATURE_DISABLED: which switch blocked the call. */
export interface FeatureDisabledErrorExtra {
  feature: FeatureFlagKey;
}
