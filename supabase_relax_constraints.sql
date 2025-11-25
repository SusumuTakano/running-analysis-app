-- ==========================================
-- user_profiles テーブルの制約を緩和
-- 既存会員のログインを優先し、後から情報を追加できるようにする
-- ==========================================

-- Step 1: NOT NULL 制約を緩和
-- ==========================================

-- name_kana を NULL 許可
ALTER TABLE public.user_profiles 
ALTER COLUMN name_kana DROP NOT NULL;

-- gender を NULL 許可
ALTER TABLE public.user_profiles 
ALTER COLUMN gender DROP NOT NULL;

-- birthdate を NULL 許可
ALTER TABLE public.user_profiles 
ALTER COLUMN birthdate DROP NOT NULL;

-- age を NULL 許可
ALTER TABLE public.user_profiles 
ALTER COLUMN age DROP NOT NULL;

-- height_cm を NULL 許可
ALTER TABLE public.user_profiles 
ALTER COLUMN height_cm DROP NOT NULL;

-- prefecture を NULL 許可
ALTER TABLE public.user_profiles 
ALTER COLUMN prefecture DROP NOT NULL;

-- Step 2: gender のチェック制約を削除
-- ==========================================

-- 既存のチェック制約を削除
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_gender_check;

-- より柔軟なチェック制約を追加（NULL も許可）
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_gender_check 
CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));

-- Step 3: age のチェック制約を調整
-- ==========================================

ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_age_check;

-- NULL または 0-150 の範囲を許可
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_age_check 
CHECK (age IS NULL OR (age >= 0 AND age <= 150));

-- Step 4: height_cm のチェック制約を調整
-- ==========================================

ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_height_cm_check;

-- NULL または 50-250 の範囲を許可
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_height_cm_check 
CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 250));

-- Step 5: テーブル構造の確認
-- ==========================================

SELECT 
  '✅ 制約緩和完了 - テーブル構造' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Step 6: 制約の確認
-- ==========================================

SELECT 
  '✅ チェック制約一覧' as info,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.user_profiles'::regclass
  AND contype = 'c'
ORDER BY conname;
