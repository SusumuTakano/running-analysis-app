-- RLS（Row Level Security）ポリシーの確認

-- 現在のRLSステータス
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- profilesテーブルのポリシー
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- running_analysis_sessionsテーブルのポリシー
SELECT * FROM pg_policies WHERE tablename = 'running_analysis_sessions';

-- ポリシーが厳しすぎる場合、一時的に無効化（開発環境のみ）
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.running_analysis_sessions DISABLE ROW LEVEL SECURITY;
