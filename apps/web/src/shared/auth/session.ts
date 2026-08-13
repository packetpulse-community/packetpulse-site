import { cookies } from "next/headers";
import { apiFetch, ApiError } from "../api/http-client";

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  isApproved: boolean;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
}

// Server-side session resolution — Server Components/layouts call this instead of
// the client ever reading the (httpOnly, unreadable) access token directly (plan §6).
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  try {
    return await apiFetch<SessionUser | null>("/auth/me", { cookieHeader });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
    throw err;
  }
}
