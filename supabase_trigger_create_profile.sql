-- ユーザー登録時に自動的にプロフィールを作成するトリガー

-- トリガー関数を作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'guest',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 既存のトリガーを削除（存在する場合）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- トリガーを作成
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLSポリシーを設定
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のプロフィールを読み取れる
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- ユーザーは自分のプロフィールを更新できる
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- サービスロールは全てのプロフィールにアクセスできる
CREATE POLICY "Service role can do everything"
  ON public.profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- 既存のユーザーでプロフィールが存在しない場合は作成
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  'guest',
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
