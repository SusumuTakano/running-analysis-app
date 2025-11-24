/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // 必要なら他の環境変数もここに足していく
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
