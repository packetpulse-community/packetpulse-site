import { ConfigService } from "@nestjs/config";
import { Global, Module } from "@nestjs/common";
import { SUPABASE_CLIENT, supabaseClientProvider } from "./supabase-client.provider";
import { StorageProvider } from "../storage/storage-provider";
import { SupabaseStorageProvider } from "../storage/supabase-storage.provider";

// Global so any module (identity, realtime, storage) can inject SUPABASE_CLIENT
// without importing this module directly (platform-mode plan §2-4).
@Global()
@Module({
  providers: [
    supabaseClientProvider,
    {
      provide: StorageProvider,
      inject: [ConfigService, SUPABASE_CLIENT],
      useFactory: (config: ConfigService, supabase) =>
        config.get<string>("PLATFORM_MODE") === "supabase" ? new SupabaseStorageProvider(supabase) : null,
    },
  ],
  exports: [SUPABASE_CLIENT, StorageProvider],
})
export class SupabaseModule {}
