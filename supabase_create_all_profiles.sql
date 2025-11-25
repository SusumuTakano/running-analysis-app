-- ==========================================
-- 既存会員全員にプロフィールを作成
-- 必須項目を最小限にして全員ログイン可能にする
-- ==========================================

-- Step 1: 現在の状況を確認
-- ==========================================
SELECT 
  '📊 現在の状況' as info,
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM public.user_profiles) as existing_profiles,
  (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM public.user_profiles)) as missing_profiles;

-- Step 2: プロフィールがないユーザーに最小限のプロフィールを作成
-- ==========================================
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
)
SELECT 
  u.id,
  COALESCE(u.email, 'ユーザー') as name,           -- メールアドレスを名前として使用
  'ゆーざー' as name_kana,
  'other' as gender,                               -- 性別不明として登録
  '1990-01-01'::DATE as birthdate,                 -- デフォルト生年月日
  34 as age,                                        -- デフォルト年齢
  170.0 as height_cm,                               -- デフォルト身長
  '未設定' as prefecture,                           -- 都道府県未設定
  NULL as organization
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 3: 作成結果を確認
-- ==========================================
SELECT 
  '✅ プロフィール作成完了' as result,
  p.id,
  p.name,
  p.height_cm,
  p.prefecture,
  u.email,
  p.created_at
FROM public.user_profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC
LIMIT 20;

-- Step 4: 最終確認
-- ==========================================
SELECT 
  '🎉 最終結果' as info,
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM public.user_profiles) as total_profiles,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.user_profiles)
    THEN '✅ 全員プロフィール作成済み'
    ELSE '⚠️ まだ未作成あり'
  END as status;

-- Step 5: プロフィールがないユーザーを確認（念のため）
-- ==========================================
SELECT 
  '⚠️ プロフィール未作成ユーザー（残り）' as warning,
  u.id,
  u.email,
  u.created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id = u.id
)
ORDER BY u.created_at DESC;
