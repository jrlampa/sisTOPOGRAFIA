/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DG_WIZARD_FULL_MODE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ALLOWED_EMAIL_DOMAIN?: string;
  readonly VITE_DEFAULT_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
