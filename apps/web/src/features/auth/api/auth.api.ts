import { apiFetchClient } from "@/shared/api/http-client";
import type { LoginDto, RegisterDto } from "@packetpulse/types";
import type { SessionUser } from "@/shared/auth/session";

export const authApi = {
  login: (dto: LoginDto) => apiFetchClient<{ user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify(dto) }),
  register: (dto: RegisterDto) => apiFetchClient<SessionUser>("/auth/register", { method: "POST", body: JSON.stringify(dto) }),
  logout: () => apiFetchClient<{ success: boolean }>("/auth/logout", { method: "POST" }),
};
