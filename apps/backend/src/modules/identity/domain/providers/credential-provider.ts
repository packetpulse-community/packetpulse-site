// Abstract class used as a DI token, same pattern as UserRepository (plan §3). This
// is the ONLY thing that changes between PLATFORM_MODE=docker and =supabase for
// auth: where passwords are stored/verified. Session issuance (our own JWT access
// + DB-backed rotating refresh tokens, TokenService/AuthCookieService), RBAC,
// approval, and email-verification/OTP flows stay identical and DB-owned in both
// modes — only credential storage moves to Supabase Auth (platform-mode plan §2).
export abstract class CredentialProvider {
  // Returns `id` when the provider itself mints the identity's primary key
  // (Supabase mode — Supabase's auth.users.id becomes our User.id so RBAC/approval
  // joins keep working unchanged), or `passwordHash` when the caller must persist
  // it locally (docker mode). Exactly one of the two is set.
  abstract createCredential(
    email: string,
    password: string,
    options?: { autoConfirm?: boolean },
  ): Promise<{ id?: string; passwordHash?: string }>;

  // Throws UnauthorizedException on invalid credentials. `storedPasswordHash` is
  // only meaningful in docker mode — Supabase mode ignores it and calls out instead.
  abstract verifyCredential(
    email: string,
    password: string,
    storedPasswordHash: string | null,
  ): Promise<void>;

  // Returns a new `passwordHash` to persist locally (docker mode), or nothing when
  // the provider updates the credential itself (Supabase mode).
  abstract updateCredential(userId: string, email: string, newPassword: string): Promise<{ passwordHash?: string }>;
}
