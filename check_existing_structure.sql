-- ============================================
-- 既存のテーブル構造を確認
-- ============================================

-- 1. running_analysis_sessionsテーブルのカラムを詳しく確認
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'running_analysis_sessions'
    AND table_schema = 'public'
ORDER BY 
    ordinal_position;

-- 2. 実際のデータサンプル（最新1件の全カラム）
SELECT * FROM public.running_analysis_sessions 
ORDER BY created_at DESC 
LIMIT 1 \gx

-- 3. JSONB型のカラムがあるか確認
SELECT 
    column_name,
    data_type
FROM 
    information_schema.columns
WHERE 
    table_name = 'running_analysis_sessions'
    AND table_schema = 'public'
    AND data_type = 'jsonb';

-- 4. 関連テーブルの存在確認
SELECT 
    table_name 
FROM 
    information_schema.tables 
WHERE 
    table_schema = 'public' 
    AND table_name LIKE '%step%' 
    OR table_name LIKE '%metric%'
    OR table_name LIKE '%analysis%'
    OR table_name LIKE '%pose%'
    OR table_name LIKE '%angle%'
ORDER BY 
    table_name;

-- 5. session_dataカラムがJSONB型の場合、その中身を確認
SELECT 
    id,
    created_at,
    jsonb_pretty(session_data) as formatted_session_data
FROM 
    public.running_analysis_sessions
WHERE 
    session_data IS NOT NULL
ORDER BY 
    created_at DESC
LIMIT 1;