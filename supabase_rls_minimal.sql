-- ==========================================
-- Running Analysis App - Minimal RLS Setup
-- RLSを一旦無効化して、シンプルなポリシーのみ設定
-- ==========================================

-- Step 1: すべてのRLSポリシーを削除
-- ==========================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.user_profiles;

-- Step 2: RLSを無効化（開発版として）
-- ==========================================

ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- Step 3: テーブル権限を再設定（全認証ユーザーに全権限）
-- ==========================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO anon;

-- Step 4: 確認クエリ
-- ==========================================

-- RLS状態を確認
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN '🔒 RLS有効'
    ELSE '🔓 RLS無効'
  END as rls_status
FROM pg_tables
LEFT JOIN pg_class ON pg_tables.tablename = pg_class.relname
WHERE schemaname = 'public' 
  AND tablename = 'user_profiles';

-- テーブル権限を確認
SELECT 
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles';

-- 既存のユーザープロフィールを確認
SELECT 
  id,
  name,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

SELECT 
  COUNT(*) as profile_count
FROM public.user_profiles;
