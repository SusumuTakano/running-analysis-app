// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 型安全のための簡単チェック（ないときはコンソールにエラー）
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase の URL または anon key が設定されていません。.env.local を確認してください。"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
