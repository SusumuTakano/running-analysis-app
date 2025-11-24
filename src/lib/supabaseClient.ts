// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 型安全のための簡単チェック（ないときはコンソールにエラー）
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase の URL または anon key が設定されていません。.env.local を確認してください。"
  );
  console.error("VITE_SUPABASE_URL:", supabaseUrl);
  console.error("VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "存在します" : "未設定");
} else {
  console.log("✅ Supabase client initialized successfully");
  console.log("Supabase URL:", supabaseUrl);
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // 開発環境ではメール確認をスキップ（本番環境では削除してください）
    // flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'running-analysis-app'
    }
  }
});

// Supabase認証イベントのデバッグ（重要なイベントのみログ）
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
    console.log('🔐 Auth state changed:', event, session?.user?.email);
  }
});
