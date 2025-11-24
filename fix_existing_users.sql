-- 既存のゲストユーザーにトライアル期間を設定

-- すべてのゲストユーザーにトライアル期間を付与
UPDATE public.profiles
SET 
  trial_start_date = COALESCE(trial_start_date, created_at, NOW()),
  trial_end_date = COALESCE(trial_end_date, created_at + INTERVAL '7 days', NOW() + INTERVAL '7 days'),
  subscription_status = COALESCE(subscription_status, 'trialing')
WHERE role = 'guest' 
  AND (trial_end_date IS NULL OR trial_start_date IS NULL);

-- 結果を確認
SELECT 
  id,
  email,
  role,
  trial_start_date,
  trial_end_date,
  subscription_status,
  created_at
FROM public.profiles
WHERE role = 'guest';
