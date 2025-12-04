-- running_analysis_sessionsテーブルの構造を確認
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'running_analysis_sessions'
    AND table_schema = 'public'
ORDER BY 
    ordinal_position;

-- 実際のデータサンプルを確認（最新5件）
SELECT * FROM public.running_analysis_sessions 
ORDER BY created_at DESC 
LIMIT 5;

-- athletesテーブルの構造も確認
SELECT 
    column_name,
    data_type,
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'athletes'
    AND table_schema = 'public'
ORDER BY 
    ordinal_position;