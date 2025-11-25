-- ==========================================
-- シンプルなテスト：ユーザー確認とプロフィール作成
-- ==========================================

-- Step 1: auth.users テーブルを確認
-- ==========================================
SELECT 
  'Step 1: 認証ユーザー確認' as step,
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Step 2: user_profiles テーブルの構造を確認
-- ==========================================
SELECT 
  'Step 2: テーブル構造確認' as step,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Step 3: テストプロフィールを直接作成（UUIDを手動で指定）
-- ==========================================
-- まず、テストユーザーを auth.users から取得してプロフィールを作成
-- もし auth.users が空の場合は、新規登録が必要です

-- auth.users にユーザーがいる場合のみ実行される
DO $$
DECLARE
  test_user_id UUID;
  test_user_email TEXT;
BEGIN
  -- 最新のユーザーを取得
  SELECT id, email INTO test_user_id, test_user_email
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- ユーザーが存在する場合
  IF test_user_id IS NOT NULL THEN
    RAISE NOTICE 'Found user: % (%)', test_user_email, test_user_id;
    
    -- プロフィールが既に存在するかチェック
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = test_user_id) THEN
      -- プロフィールを作成
      INSERT INTO public.user_profiles (
        id,
        name,
        name_kana,
        gender,
        birthdate,
        age,
        height_cm,
        prefecture,
        organization
      ) VALUES (
        test_user_id,
        'テストユーザー',
        'てすとゆーざー',
        'male',
        '1990-01-01',
        34,
        170.0,
        '東京都',
        NULL
      );
      RAISE NOTICE 'Profile created successfully for user: %', test_user_email;
    ELSE
      RAISE NOTICE 'Profile already exists for user: %', test_user_email;
    END IF;
  ELSE
    RAISE NOTICE 'No users found in auth.users table';
    RAISE NOTICE 'Please register a new user first';
  END IF;
END $$;

-- Step 4: 作成結果を確認
-- ==========================================
SELECT 
  'Step 4: プロフィール確認' as step,
  p.id,
  p.name,
  p.name_kana,
  p.height_cm,
  u.email as email
FROM public.user_profiles p
LEFT JOIN auth.users u ON p.id = u.id;

-- Step 5: 最終確認
-- ==========================================
SELECT 
  'Step 5: 最終確認' as step,
  (SELECT COUNT(*) FROM auth.users) as auth_users_count,
  (SELECT COUNT(*) FROM public.user_profiles) as profiles_count;
