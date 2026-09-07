import { apiFetchClient } from "@/shared/api/http-client";
import type { UpdateProfileDto, ChangePasswordDto, DeleteAccountDto } from "@packetpulse/types";
import type { SessionUser } from "@/shared/auth/session";

export const profileClientApi = {
  updateProfile: (dto: UpdateProfileDto) =>
    apiFetchClient<SessionUser>("/users/profile", { method: "PUT", body: JSON.stringify(dto) }),
  changePassword: (dto: ChangePasswordDto) =>
    apiFetchClient<{ success: boolean }>("/users/profile/password", { method: "PUT", body: JSON.stringify(dto) }),
  deleteAccount: (dto: DeleteAccountDto) =>
    apiFetchClient<{ success: boolean }>("/users/profile", { method: "DELETE", body: JSON.stringify(dto) }),
};
