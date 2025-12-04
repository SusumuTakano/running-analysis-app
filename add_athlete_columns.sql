-- running_analysis_sessionsテーブルに選手関連カラムを追加
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS athlete_id UUID REFERENCES public.athletes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS athlete_name TEXT;

-- インデックスを追加（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_running_analysis_sessions_athlete_id 
ON public.running_analysis_sessions(athlete_id);

-- 既存のRLSポリシーを確認（必要に応じて）
-- すでにRLSが有効な場合は、新しいカラムも含めて適切にアクセス制御されます

-- 確認用クエリ
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'running_analysis_sessions' 
AND column_name IN ('athlete_id', 'athlete_name');