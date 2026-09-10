import { Inject, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../../../common/supabase/supabase-client.provider";
import { CredentialProvider } from "../../domain/providers/credential-provider";

@Injectable()
export class SupabaseCredentialProvider extends CredentialProvider {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {
    super();
  }

  async createCredential(email: string, password: string, options?: { autoConfirm?: boolean }) {
    const { data, error } = await this.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: options?.autoConfirm ?? false,
    });
    if (error || !data.user) {
      throw new InternalServerErrorException(`Supabase Auth: failed to create user (${error?.message})`);
    }
    return { id: data.user.id };
  }

  // Ignores storedPasswordHash — Supabase mode never stores a local hash, Supabase
  // itself owns credential verification.
  async verifyCredential(email: string, password: string) {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new UnauthorizedException("Invalid credentials");
  }

  async updateCredential(userId: string, email: string, newPassword: string) {
    const { error } = await this.supabase.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) throw new InternalServerErrorException(`Supabase Auth: failed to update password (${error.message})`);
    return {};
  }
}
