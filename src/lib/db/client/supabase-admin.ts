import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/db/env";

declare global {
  var __malalaSupabaseAdmin:
    | ReturnType<typeof createClient>
    | undefined;
}

export function createSupabaseAdminClient() {
  if (!globalThis.__malalaSupabaseAdmin) {
    globalThis.__malalaSupabaseAdmin = createClient(
      getSupabaseUrl(),
      getSupabaseServiceRoleKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return globalThis.__malalaSupabaseAdmin;
}
