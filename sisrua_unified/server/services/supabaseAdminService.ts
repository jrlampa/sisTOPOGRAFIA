import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

let supabaseAdminClient: ReturnType<typeof createClient> | null | undefined;

export function getSupabaseAdminClient() {
  if (supabaseAdminClient !== undefined) {
    return supabaseAdminClient;
  }

  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdminClient = null;
    return supabaseAdminClient;
  }

  supabaseAdminClient = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return supabaseAdminClient;
}

export async function getSupabaseUserById(userId: string) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error) {
    throw new Error(error.message);
  }

  return data.user ?? null;
}