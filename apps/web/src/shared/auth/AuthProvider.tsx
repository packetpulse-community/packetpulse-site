"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "./session";

const AuthContext = createContext<SessionUser | null>(null);

// Receives the already-resolved user as a server-passed prop (no client-side "am I
// logged in" fetch waterfall) — the server (layout.tsx) did the real auth check
// against the httpOnly cookie; this just makes that result available to client
// components (nav bar, profile menu) (plan §6).
export function AuthProvider({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
