-- RLS ポリシーの修正と確認
-- 既存のポリシーを削除して再作成

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- RLS を一旦無効化して再度有効化
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- より明示的なポリシーを作成
-- SELECT: 認証済みユーザーは自分のプロフィールを閲覧可能
CREATE POLICY "Enable read access for authenticated users"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- INSERT: 認証済みユーザーは自分のプロフィールを作成可能
CREATE POLICY "Enable insert for authenticated users"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: 認証済みユーザーは自分のプロフィールを更新可能
CREATE POLICY "Enable update for authenticated users"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: 認証済みユーザーは自分のプロフィールを削除可能
CREATE POLICY "Enable delete for authenticated users"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- テーブル権限の確認と設定
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;

-- デバッグ用: 現在のポリシーを確認
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles';
