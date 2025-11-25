-- ==========================================
-- Running Analysis App - Complete Supabase Setup
-- ==========================================

-- Step 1: user_profiles テーブルを作成
-- ==========================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_kana TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  birthdate DATE NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 150),
  height_cm DECIMAL(5,1) NOT NULL CHECK (height_cm >= 50 AND height_cm <= 250),
  prefecture TEXT NOT NULL,
  organization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: 更新日時を自動更新するトリガー
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 3: RLS (Row Level Security) を有効化
-- ==========================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS ポリシーを作成
-- ==========================================

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

-- Step 5: テーブル権限を設定
-- ==========================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;

-- Step 6: デベロッパー版期限チェック用の関数
-- ==========================================

CREATE OR REPLACE FUNCTION is_developer_period_valid()
RETURNS BOOLEAN AS $$
BEGIN
  -- 2025年12月31日まで有効
  RETURN CURRENT_DATE <= '2025-12-31'::DATE;
END;
$$ LANGUAGE plpgsql;

-- Step 7: 確認クエリ（実行後に確認）
-- ==========================================

-- テーブルが作成されたか確認
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- RLSポリシーが作成されたか確認
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'user_profiles';
