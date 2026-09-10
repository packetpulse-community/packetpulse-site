import { Global, Module } from "@nestjs/common";
import { SUPABASE_CLIENT, supabaseClientProvider } from "./supabase-client.provider";

// Global so any module (identity, realtime, storage) can inject SUPABASE_CLIENT
// without importing this module directly (platform-mode plan §2-4).
@Global()
@Module({
  providers: [supabaseClientProvider],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
