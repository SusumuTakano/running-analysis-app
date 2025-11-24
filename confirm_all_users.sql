-- 既存テストユーザーのみメール確認済みにする
-- Supabase SQL Editorで実行してください
-- ※新規ユーザーには引き続きメール確認が必要です

-- ステップ1: 現在の状態を確認
SELECT 
  id, 
  email, 
  email_confirmed_at, 
  confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '未確認'
    ELSE '確認済み'
  END as status
FROM auth.users
WHERE email = '8460susumu@gmail.com';

-- ステップ2: このユーザーのみメール確認済みにする
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = '8460susumu@gmail.com'
  AND email_confirmed_at IS NULL;

-- ステップ3: 更新後の状態を確認
SELECT 
  id, 
  email, 
  email_confirmed_at, 
  confirmed_at,
  created_at,
  '確認済み' as status
FROM auth.users
WHERE email = '8460susumu@gmail.com';
