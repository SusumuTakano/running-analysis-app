# データベースマイグレーション手順

## 重要：解析データの完全保存のために

現在、基本的なデータ（距離、時間、速度）のみが保存されています。
詳細な解析データ（ステップメトリクス、関節角度など）を保存するには、以下のテーブルを作成する必要があります。

## 1. 詳細解析データ用のテーブル作成（推奨）

`create_analysis_tables.sql`を実行して、以下のテーブルを作成してください：

- **step_metrics**: 各ステップの詳細データ（接地時間、滞空時間、ストライド長など）
- **three_phase_angles**: 3局面の関節角度データ
- **step_summaries**: ステップの統計サマリー
- **pose_estimations**: フレーム毎の姿勢推定データ（オプション）
- **ai_feedbacks**: AIによるフィードバック（オプション）

```sql
-- create_analysis_tables.sqlの内容を実行
```

## 2. 選手紐付け機能のためのカラム追加（オプション）

### 1. 必要なカラムの追加

以下のSQLをSupabaseのSQL Editorで実行してください：

```sql
-- running_analysis_sessionsテーブルに選手関連カラムを追加
ALTER TABLE public.running_analysis_sessions 
ADD COLUMN IF NOT EXISTS athlete_id UUID REFERENCES public.athletes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS athlete_name TEXT;

-- インデックスを追加（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_running_analysis_sessions_athlete_id 
ON public.running_analysis_sessions(athlete_id);
```

### 2. 確認

カラムが正しく追加されたか確認：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'running_analysis_sessions' 
AND column_name IN ('athlete_id', 'athlete_name');
```

### 3. 既存データの移行（オプション）

既存のセッションに選手を紐付けたい場合：

```sql
-- 例: 特定のユーザーのすべてのセッションに選手を紐付け
UPDATE public.running_analysis_sessions 
SET 
  athlete_id = '選手のUUID',
  athlete_name = '選手名'
WHERE user_id = 'ユーザーのUUID' 
AND athlete_id IS NULL;
```

## データ構造の確認

現在のテーブル構造を確認するには、`check_session_columns.sql`を実行してください：

```sql
-- running_analysis_sessionsテーブルの構造を確認
SELECT 
    column_name,
    data_type,
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'running_analysis_sessions'
    AND table_schema = 'public'
ORDER BY 
    ordinal_position;
```

## トラブルシューティング

### エラー: "column running_analysis_sessions.athlete_id does not exist"

このエラーが表示される場合は、上記のALTER TABLEコマンドを実行してください。

### 権限エラー

Supabaseダッシュボードの管理者権限でSQL Editorを使用してください。

## 注意事項

- `athlete_id`は外部キー制約があるため、存在しない選手IDは設定できません
- 選手が削除された場合、関連するセッションの`athlete_id`は自動的にNULLになります（ON DELETE SET NULL）
- `athlete_name`は冗長ですが、パフォーマンスとユーザビリティのために保存しています