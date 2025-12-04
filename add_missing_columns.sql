-- ============================================
-- running_analysis_sessionsテーブルに不足しているカラムを追加
-- ============================================

-- video_filenameカラムを追加（存在しない場合）
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS video_filename TEXT;

-- frame_countカラムを追加（存在しない場合）
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS frame_count INTEGER;

-- avg_stride_mカラムを追加（存在しない場合）
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS avg_stride_m REAL;

-- avg_cadence_hzカラムを追加（存在しない場合）
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS avg_cadence_hz REAL;

-- avg_contact_time_sカラムを追加（存在しない場合）
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS avg_contact_time_s REAL;

-- avg_flight_time_sカラムを追加（存在しない場合）
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS avg_flight_time_s REAL;

-- source_video_duration_sカラムを追加（存在しない場合）
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS source_video_duration_s REAL;

-- section_start_typeカラムを追加（存在しない場合）
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS section_start_type VARCHAR(50);

-- section_end_typeカラムを追加（存在しない場合）
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS section_end_type VARCHAR(50);

-- 追加されたカラムを確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'running_analysis_sessions' 
AND column_name IN (
  'video_filename',
  'frame_count',
  'avg_stride_m',
  'avg_cadence_hz',
  'avg_contact_time_s',
  'avg_flight_time_s',
  'source_video_duration_s',
  'section_start_type',
  'section_end_type'
)
ORDER BY column_name;