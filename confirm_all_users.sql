-- 開発環境用：すべてのユーザーをメール確認済みにする
-- Supabase SQL Editorで実行してください

-- auth.users テーブルのすべてのユーザーをメール確認済みにする
UPDATE auth.users
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 確認状況をチェック
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;
