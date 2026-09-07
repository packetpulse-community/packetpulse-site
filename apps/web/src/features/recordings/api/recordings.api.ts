import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { Paginated } from "@/features/blogs/api/blogs.api";

export interface RecordingInstructor {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface RecordingSummary {
  id: string;
  title: string;
  description: string;
  recordingUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  category: string;
  premium: boolean;
  isApproved: boolean;
  views: number;
  recordedAt: string;
  instructor: RecordingInstructor;
  tags: { tag: string }[];
  _count: { likes: number; participants: number };
}

export const recordingsServerApi = {
  list: (cookieHeader: string, query = "") => apiFetch<Paginated<RecordingSummary>>(`/recordings${query}`, { cookieHeader }),
  getById: (id: string, cookieHeader: string) => apiFetch<RecordingSummary>(`/recordings/${id}`, { cookieHeader }),
  // No dedicated "related recordings" endpoint — reuses the list endpoint filtered
  // to the current recording's category, same pattern as blogs' related posts.
  related: (category: string, excludeId: string, cookieHeader: string) =>
    apiFetch<Paginated<RecordingSummary>>(`/recordings?category=${category}&limit=5`, { cookieHeader }).then((res) =>
      res.data.filter((r) => r.id !== excludeId).slice(0, 4),
    ),
};

export const recordingsClientApi = {
  toggleLike: (id: string) => apiFetchClient<{ liked: boolean }>(`/recordings/${id}/like`, { method: "PUT" }),
  join: (id: string) => apiFetchClient<{ joined: boolean }>(`/recordings/${id}/join`, { method: "POST" }),
};
