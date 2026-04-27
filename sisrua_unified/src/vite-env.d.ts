/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DG_WIZARD_FULL_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
