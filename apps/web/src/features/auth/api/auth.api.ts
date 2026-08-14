import { apiFetchClient } from "@/shared/api/http-client";
import type { LoginDto, RegisterDto, ForgotPasswordDto, VerifyOtpDto, ResetPasswordDto } from "@packetpulse/types";
import type { SessionUser } from "@/shared/auth/session";

export const authApi = {
  login: (dto: LoginDto) => apiFetchClient<{ user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify(dto) }),
  register: (dto: RegisterDto) => apiFetchClient<SessionUser>("/auth/register", { method: "POST", body: JSON.stringify(dto) }),
  logout: () => apiFetchClient<{ success: boolean }>("/auth/logout", { method: "POST" }),
  forgotPassword: (dto: ForgotPasswordDto) =>
    apiFetchClient<{ success: boolean }>("/auth/forgotpassword", { method: "POST", body: JSON.stringify(dto) }),
  verifyOtp: (dto: VerifyOtpDto) => apiFetchClient<{ tempToken: string }>("/auth/verifyotp", { method: "POST", body: JSON.stringify(dto) }),
  resetPassword: (dto: ResetPasswordDto) =>
    apiFetchClient<{ success: boolean }>("/auth/resetpassword", { method: "POST", body: JSON.stringify(dto) }),
};
