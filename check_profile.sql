-- 8460susumu@gmail.com のユーザーIDとプロフィールを確認
SELECT 
  u.id as user_id,
  u.email,
  p.name,
  p.height_cm,
  p.prefecture
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE u.email = '8460susumu@gmail.com';
