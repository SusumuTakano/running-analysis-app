-- ============================================
-- ランニング解析データ用の詳細テーブル作成
-- ============================================

-- 1. ステップメトリクス（各歩のデータ）テーブル
CREATE TABLE IF NOT EXISTS public.step_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.running_analysis_sessions(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  
  -- タイミング情報
  contact_frame INTEGER,
  toe_off_frame INTEGER,
  next_contact_frame INTEGER,
  
  -- 時間データ
  contact_time REAL,
  flight_time REAL,
  step_time REAL,
  
  -- 距離・速度データ
  stride_length REAL,
  speed REAL,
  
  -- 位置データ
  contact_x REAL,
  contact_y REAL,
  toe_off_x REAL,
  toe_off_y REAL,
  
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(session_id, step_index)
);

-- 2. 3局面の関節角度データテーブル
CREATE TABLE IF NOT EXISTS public.three_phase_angles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.running_analysis_sessions(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  phase VARCHAR(20) NOT NULL, -- 'contact', 'mid_support', 'toe_off'
  
  -- 関節角度データ
  hip_angle REAL,
  knee_angle REAL,
  ankle_angle REAL,
  
  -- 体幹角度
  trunk_angle REAL,
  
  -- その他の角度
  shoulder_angle REAL,
  elbow_angle REAL,
  
  -- フレーム番号
  frame_number INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(session_id, step_index, phase)
);

-- 3. ステップサマリー（統計データ）テーブル
CREATE TABLE IF NOT EXISTS public.step_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.running_analysis_sessions(id) ON DELETE CASCADE,
  
  -- 平均値
  avg_stride_length REAL,
  avg_contact_time REAL,
  avg_flight_time REAL,
  avg_speed REAL,
  avg_cadence REAL,
  
  -- 標準偏差
  std_stride_length REAL,
  std_contact_time REAL,
  std_flight_time REAL,
  std_speed REAL,
  
  -- 最大値・最小値
  max_stride_length REAL,
  min_stride_length REAL,
  max_speed REAL,
  min_speed REAL,
  
  -- ステップ数
  total_steps INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(session_id)
);

-- 4. フレーム毎の姿勢推定データ（オプション、データ量が多い）
CREATE TABLE IF NOT EXISTS public.pose_estimations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.running_analysis_sessions(id) ON DELETE CASCADE,
  frame_number INTEGER NOT NULL,
  
  -- 姿勢推定データ（JSON形式で保存）
  landmarks JSONB, -- MediaPipeのランドマーク座標
  
  -- 主要な関節位置（高速アクセス用）
  hip_x REAL,
  hip_y REAL,
  knee_x REAL,
  knee_y REAL,
  ankle_x REAL,
  ankle_y REAL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(session_id, frame_number)
);

-- 5. AIフィードバックテーブル
CREATE TABLE IF NOT EXISTS public.ai_feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.running_analysis_sessions(id) ON DELETE CASCADE,
  
  -- AI評価
  overall_score REAL,
  stride_score REAL,
  contact_time_score REAL,
  form_score REAL,
  
  -- フィードバックテキスト
  overall_feedback TEXT,
  improvement_points TEXT[],
  strengths TEXT[],
  
  -- 推奨事項
  recommendations JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(session_id)
);

-- インデックスの作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_step_metrics_session ON public.step_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_three_phase_angles_session ON public.three_phase_angles(session_id);
CREATE INDEX IF NOT EXISTS idx_step_summaries_session ON public.step_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_pose_estimations_session ON public.pose_estimations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedbacks_session ON public.ai_feedbacks(session_id);

-- RLS（Row Level Security）の設定
ALTER TABLE public.step_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.three_phase_angles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pose_estimations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedbacks ENABLE ROW LEVEL SECURITY;

-- RLSポリシーの作成（認証されたユーザーのみアクセス可能）
CREATE POLICY "Users can view all step_metrics" ON public.step_metrics
  FOR SELECT USING (true);

CREATE POLICY "Users can insert step_metrics" ON public.step_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view all three_phase_angles" ON public.three_phase_angles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert three_phase_angles" ON public.three_phase_angles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view all step_summaries" ON public.step_summaries
  FOR SELECT USING (true);

CREATE POLICY "Users can insert step_summaries" ON public.step_summaries
  FOR INSERT WITH CHECK (true);

-- 確認用クエリ
SELECT 
  table_name,
  COUNT(*) as column_count
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public' 
  AND table_name IN ('step_metrics', 'three_phase_angles', 'step_summaries', 'pose_estimations', 'ai_feedbacks')
GROUP BY 
  table_name
ORDER BY 
  table_name;