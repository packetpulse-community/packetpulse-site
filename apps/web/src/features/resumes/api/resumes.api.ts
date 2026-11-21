import type {
  CreateResumeUploadDto,
  DecideSuggestionDto,
  ProfileEntries,
  ResumeOverview,
  ResumeSuggestionView,
  ResumeUploadStart,
  ResumeView,
} from "@packetpulse/types";
import { apiFetchClient } from "@/shared/api/http-client";

const json = (body: unknown) => JSON.stringify(body);

// SCR-012 resume review (TASK-024). Every call works on the signed-in member's own resume.
export const resumesApi = {
  overview: () => apiFetchClient<ResumeOverview>("/resumes"),
  startUpload: (dto: CreateResumeUploadDto) => apiFetchClient<ResumeUploadStart>("/resumes/upload-url", { method: "POST", body: json(dto) }),
  complete: (id: string) => apiFetchClient<ResumeView>(`/resumes/${id}/complete`, { method: "POST" }),
  retry: (id: string) => apiFetchClient<ResumeView>(`/resumes/${id}/retry`, { method: "POST" }),
  link: (id: string) => apiFetchClient<{ url: string; expiresInSeconds: number; originalName: string }>(`/resumes/${id}/link`),
  remove: (id: string) => apiFetchClient<{ success: boolean }>(`/resumes/${id}`, { method: "DELETE" }),
  decide: (suggestionId: string, dto: DecideSuggestionDto) =>
    apiFetchClient<ResumeSuggestionView>(`/resumes/suggestions/${suggestionId}`, { method: "PUT", body: json(dto) }),
  entries: () => apiFetchClient<ProfileEntries>("/resumes/profile-entries"),
  removeEntry: (kind: "education" | "experience", id: string) =>
    apiFetchClient<{ success: boolean }>(`/resumes/profile-entries/${kind}/${id}`, { method: "DELETE" }),
};

export const resumeKeys = {
  overview: ["resumes", "overview"] as const,
  entries: ["resumes", "entries"] as const,
};
