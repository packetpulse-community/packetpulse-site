import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type {
  AddSuggestionAsSkillDto,
  CreateSkillDto,
  MemberSkill,
  Skill,
  SkillSuggestion,
  SkillSuggestionStatus,
  SkillTaxonomy,
  SetMemberSkillsDto,
  UpdateSkillDto,
} from "@packetpulse/types";

export type { MemberSkill, Skill, SkillSuggestion, SkillTaxonomy };
export type AdminSkill = Skill & { memberCount: number };
export type AdminTaxonomy = { version: number; autoMergeThreshold: number; skills: AdminSkill[] };
export type SuggestOutcome = {
  outcome: "created" | "counted" | "already_counted" | "exists";
  skillId: string | null;
  suggestion: SkillSuggestion | null;
};

const json = (body: unknown) => JSON.stringify(body);

export const skillsServerApi = {
  taxonomy: () => apiFetch<SkillTaxonomy>("/skills"),
  mine: (cookieHeader = "") => apiFetch<MemberSkill[]>("/skills/mine", { cookieHeader }),
  adminList: (cookieHeader = "") => apiFetch<AdminTaxonomy>("/skills/manage", { cookieHeader }),
  suggestions: (status: SkillSuggestionStatus, cookieHeader = "") =>
    apiFetch<SkillSuggestion[]>(`/skills/suggestions?status=${status}`, { cookieHeader }),
};

export const skillsClientApi = {
  setMine: (dto: SetMemberSkillsDto) => apiFetchClient<MemberSkill[]>("/skills/mine", { method: "PUT", body: json(dto) }),
  suggest: (name: string) => apiFetchClient<SuggestOutcome>("/skills/suggestions", { method: "POST", body: json({ name }) }),
  create: (dto: CreateSkillDto) => apiFetchClient<Skill>("/skills", { method: "POST", body: json(dto) }),
  update: (id: string, dto: UpdateSkillDto) => apiFetchClient<Skill>(`/skills/${id}`, { method: "PUT", body: json(dto) }),
  retire: (id: string, reason: string) => apiFetchClient<Skill>(`/skills/${id}/retire`, { method: "PUT", body: json({ reason }) }),
  restore: (id: string) => apiFetchClient<Skill>(`/skills/${id}/restore`, { method: "PUT", body: "{}" }),
  addAlias: (id: string, alias: string) => apiFetchClient<Skill>(`/skills/${id}/aliases`, { method: "POST", body: json({ alias }) }),
  removeAlias: (id: string, aliasId: string) => apiFetchClient<Skill>(`/skills/${id}/aliases/${aliasId}`, { method: "DELETE" }),
  addSuggestion: (id: string, dto: AddSuggestionAsSkillDto) =>
    apiFetchClient<{ suggestion: SkillSuggestion; skill: Skill }>(`/skills/suggestions/${id}/add`, { method: "PUT", body: json(dto) }),
  mergeSuggestion: (id: string, skillId: string) =>
    apiFetchClient<SkillSuggestion>(`/skills/suggestions/${id}/merge`, { method: "PUT", body: json({ skillId }) }),
  rejectSuggestion: (id: string, reason: string) =>
    apiFetchClient<SkillSuggestion>(`/skills/suggestions/${id}/reject`, { method: "PUT", body: json({ reason }) }),
};
