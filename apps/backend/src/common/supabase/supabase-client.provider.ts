import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// DI token — a shared server-side (service-role) Supabase client for any module
// that needs it in PLATFORM_MODE=supabase (auth, realtime, storage). Never used
// with the anon key: this key bypasses RLS, so it must stay backend-only.
export const SUPABASE_CLIENT = Symbol("SUPABASE_CLIENT");

export const supabaseClientProvider = {
  provide: SUPABASE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): SupabaseClient | null => {
    if (config.get<string>("PLATFORM_MODE") !== "supabase") return null;
    return createClient(config.get<string>("SUPABASE_URL")!, config.get<string>("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  },
};
