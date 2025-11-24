-- システム設定テーブル
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_api_key TEXT,
  stripe_publishable_key TEXT,
  stripe_webhook_secret TEXT,
  stripe_yearly_price_id TEXT,
  trial_period_days INTEGER DEFAULT 7,
  subscription_price_jpy INTEGER DEFAULT 500,
  app_name TEXT DEFAULT 'ランニング動作解析システム',
  support_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- プロフィールテーブルの拡張（既存テーブルに列を追加）
-- 注: テーブルが既に存在する場合は列が存在しない場合のみ追加
DO $$ 
BEGIN
  -- roleカラムが存在しない場合は追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'guest';
  END IF;

  -- trial_start_dateカラムが存在しない場合は追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='trial_start_date') THEN
    ALTER TABLE profiles ADD COLUMN trial_start_date TIMESTAMPTZ;
  END IF;

  -- trial_end_dateカラムが存在しない場合は追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='trial_end_date') THEN
    ALTER TABLE profiles ADD COLUMN trial_end_date TIMESTAMPTZ;
  END IF;

  -- subscription_statusカラムが存在しない場合は追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='subscription_status') THEN
    ALTER TABLE profiles ADD COLUMN subscription_status TEXT;
  END IF;
END $$;

-- RLS（Row Level Security）ポリシーの設定
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 管理者のみが設定を読み書きできるポリシー
CREATE POLICY "管理者のみ設定を参照可能" ON system_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "管理者のみ設定を更新可能" ON system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "管理者のみ設定を追加可能" ON system_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 初期設定レコードの挿入（存在しない場合のみ）
INSERT INTO system_settings (
  trial_period_days,
  subscription_price_jpy,
  app_name
)
SELECT 7, 500, 'ランニング動作解析システム'
WHERE NOT EXISTS (SELECT 1 FROM system_settings LIMIT 1);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_trial_end_date ON profiles(trial_end_date);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);

-- コメント
COMMENT ON TABLE system_settings IS 'システム全体の設定を管理するテーブル';
COMMENT ON COLUMN system_settings.stripe_api_key IS 'Stripe APIキー（秘密鍵）';
COMMENT ON COLUMN system_settings.stripe_publishable_key IS 'Stripe公開可能キー';
COMMENT ON COLUMN system_settings.stripe_webhook_secret IS 'Stripe Webhook署名検証シークレット';
COMMENT ON COLUMN system_settings.stripe_yearly_price_id IS '年間サブスクリプションのPrice ID';
COMMENT ON COLUMN system_settings.trial_period_days IS 'ゲストユーザーのトライアル期間（日数）';
COMMENT ON COLUMN system_settings.subscription_price_jpy IS 'サブスクリプション価格（円）';
