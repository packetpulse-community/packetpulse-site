import type {
  ConsentPolicyView,
  MyConsentView,
  ProfilePrivacyView,
  UpdateConsentInput,
  UpdateProfilePrivacyInput,
} from "@packetpulse/types";
import { apiFetchClient } from "@/shared/api/http-client";

export const privacyApi = {
  // Public: the registration form reads these before an account exists.
  policies: () => apiFetchClient<ConsentPolicyView[]>("/consent/policies"),
  myConsents: () => apiFetchClient<MyConsentView>("/consent/mine"),
  updateConsents: (input: UpdateConsentInput) =>
    apiFetchClient<MyConsentView>("/consent/mine", { method: "PUT", body: JSON.stringify(input) }),
  getVisibility: () => apiFetchClient<ProfilePrivacyView>("/users/profile/privacy"),
  updateVisibility: (input: UpdateProfilePrivacyInput) =>
    apiFetchClient<ProfilePrivacyView>("/users/profile/privacy", { method: "PUT", body: JSON.stringify(input) }),
};

export const privacyKeys = {
  consents: ["consent", "mine"] as const,
  visibility: ["profile", "privacy"] as const,
  policies: ["consent", "policies"] as const,
};
