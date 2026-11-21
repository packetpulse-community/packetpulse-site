import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { OnboardingStatus, SaveOnboardingDto } from "@packetpulse/types";

export type { OnboardingStatus };

export const onboardingKeys = { status: ["onboarding", "status"] as const };

export const onboardingServerApi = {
  status: (cookieHeader = "") => apiFetch<OnboardingStatus>("/onboarding", { cookieHeader }),
};

// SaveOnboardingDto is the parsed shape (WhatsApp already E.164); the server parses it again.
export const onboardingClientApi = {
  status: () => apiFetchClient<OnboardingStatus>("/onboarding"),
  save: (dto: Partial<Omit<SaveOnboardingDto, "whatsappNumber">> & { whatsappNumber?: string }) =>
    apiFetchClient<OnboardingStatus>("/onboarding", { method: "PUT", body: JSON.stringify(dto) }),
  complete: () => apiFetchClient<OnboardingStatus>("/onboarding/complete", { method: "POST", body: "{}" }),
};
