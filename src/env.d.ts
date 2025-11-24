// src/env.d.ts

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // 他にも VITE_ で始まる環境変数があればここに追加できます
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
