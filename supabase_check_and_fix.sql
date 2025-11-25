-- ==========================================
-- 既存ユーザーの確認とプロフィール手動作成
-- ==========================================

-- Step 1: auth.users テーブルの既存ユーザーを確認
-- ==========================================

SELECT 
  '📋 既存の認証ユーザー' as info,
  id,
  email,
  created_at,
  confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Step 2: user_profiles テーブルの状態を確認
-- ==========================================

SELECT 
  '📋 既存のプロフィール' as info,
  COUNT(*) as count
FROM public.user_profiles;

-- Step 3: auth.users にあるが user_profiles にないユーザーを確認
-- ==========================================

SELECT 
  '⚠️ プロフィール未作成ユーザー' as warning,
  u.id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- Step 4: テストユーザーのプロフィールを手動作成（必要に応じて実行）
-- ==========================================
-- 注意: 以下のINSERT文は、実際のユーザーIDとメールアドレスに合わせて編集してから実行してください

-- 例: 8468ususu@gmail.com ユーザーのプロフィールを作成
-- INSERT INTO public.user_profiles (
--   id,
--   name,
--   name_kana,
--   gender,
--   birthdate,
--   age,
--   height_cm,
--   prefecture,
--   organization
-- )
-- SELECT 
--   id,
--   'テスト太郎' as name,
--   'てすとたろう' as name_kana,
--   'male' as gender,
--   '1990-01-01'::DATE as birthdate,
--   34 as age,
--   170.0 as height_cm,
--   '東京都' as prefecture,
--   NULL as organization
-- FROM auth.users
-- WHERE email = '8468ususu@gmail.com'
-- AND NOT EXISTS (
--   SELECT 1 FROM public.user_profiles WHERE id = auth.users.id
-- );

-- Step 5: 作成結果を確認
-- ==========================================

SELECT 
  '✅ プロフィール作成完了' as result,
  p.id,
  p.name,
  p.email,
  u.email as auth_email
FROM public.user_profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC;
