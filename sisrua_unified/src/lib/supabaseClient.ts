import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export function isSupabaseClientConfigured(): boolean {
  return Boolean(supabase);
}

export const allowedCorporateDomain = (
  import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase() ||
  "im3brasil.com.br"
);