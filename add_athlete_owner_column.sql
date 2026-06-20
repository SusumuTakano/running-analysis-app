-- athletes テーブルに「誰が登録した選手か」を記録する owner_auth_user_id カラムを追加
-- アプリ側 (src/App.tsx / src/pages/UserAthletesPage.tsx) が既に参照している想定。

-- 1. カラム追加
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS owner_auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. インデックス（検索の高速化）
CREATE INDEX IF NOT EXISTS idx_athletes_owner_auth_user_id
  ON public.athletes(owner_auth_user_id);

-- 3. 確認用: カラムが追加されたか
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'athletes' AND table_schema = 'public'
ORDER BY ordinal_position;

-- （任意）行レベルセキュリティ: ログイン中のユーザは自分の選手しか見えないようにする
-- 既に RLS ポリシーがある場合はスキップしてください
-- ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "own athletes only" ON public.athletes
--   FOR ALL
--   USING (owner_auth_user_id = auth.uid())
--   WITH CHECK (owner_auth_user_id = auth.uid());
