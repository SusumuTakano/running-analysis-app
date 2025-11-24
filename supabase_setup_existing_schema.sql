-- 既存のprofilesテーブルに必要な列を追加
-- 既存のスキーマ:
--   id, email, full_name, organization, role, created_at, updated_at, 
--   organization_id, is_admin

-- トライアル関連の列を追加
DO $$ 
BEGIN
  -- trial_start_dateカラムが存在しない場合は追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='trial_start_date') THEN
    ALTER TABLE public.profiles ADD COLUMN trial_start_date TIMESTAMPTZ;
    COMMENT ON COLUMN public.profiles.trial_start_date IS 'トライアル開始日';
  END IF;

  -- trial_end_dateカラムが存在しない場合は追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='trial_end_date') THEN
    ALTER TABLE public.profiles ADD COLUMN trial_end_date TIMESTAMPTZ;
    COMMENT ON COLUMN public.profiles.trial_end_date IS 'トライアル終了日';
  END IF;

  -- subscription_statusカラムが存在しない場合は追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='subscription_status') THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_status TEXT;
    COMMENT ON COLUMN public.profiles.subscription_status IS 'サブスクリプション状態 (active, canceled, past_due, trialing)';
  END IF;
END $$;

-- roleフィールドのデフォルト値を設定（既存レコードでnullの場合）
UPDATE public.profiles SET role = 'guest' WHERE role IS NULL;

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_profiles_trial_end_date ON public.profiles(trial_end_date);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- システム設定テーブル
CREATE TABLE IF NOT EXISTS public.system_settings (
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

-- RLS（Row Level Security）ポリシーの設定
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（エラーを無視）
DROP POLICY IF EXISTS "管理者のみ設定を参照可能" ON public.system_settings;
DROP POLICY IF EXISTS "管理者のみ設定を更新可能" ON public.system_settings;
DROP POLICY IF EXISTS "管理者のみ設定を追加可能" ON public.system_settings;

-- 管理者のみが設定を読み書きできるポリシー（is_admin=trueまたはrole='admin'）
CREATE POLICY "管理者のみ設定を参照可能" ON public.system_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role = 'admin')
    )
  );

CREATE POLICY "管理者のみ設定を更新可能" ON public.system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role = 'admin')
    )
  );

CREATE POLICY "管理者のみ設定を追加可能" ON public.system_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role = 'admin')
    )
  );

-- 初期設定レコードの挿入（存在しない場合のみ）
INSERT INTO public.system_settings (
  trial_period_days,
  subscription_price_jpy,
  app_name
)
SELECT 7, 500, 'ランニング動作解析システム'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings LIMIT 1);

-- コメント
COMMENT ON TABLE public.system_settings IS 'システム全体の設定を管理するテーブル';
COMMENT ON COLUMN public.system_settings.stripe_api_key IS 'Stripe APIキー（秘密鍵）';
COMMENT ON COLUMN public.system_settings.stripe_publishable_key IS 'Stripe公開可能キー';
COMMENT ON COLUMN public.system_settings.stripe_webhook_secret IS 'Stripe Webhook署名検証シークレット';
COMMENT ON COLUMN public.system_settings.stripe_yearly_price_id IS '年間サブスクリプションのPrice ID';
COMMENT ON COLUMN public.system_settings.trial_period_days IS 'ゲストユーザーのトライアル期間（日数）';
COMMENT ON COLUMN public.system_settings.subscription_price_jpy IS 'サブスクリプション価格（円）';

-- 実行結果の確認
DO $$
BEGIN
  RAISE NOTICE '=== セットアップ完了 ===';
  RAISE NOTICE 'profiles テーブルに以下の列を追加しました:';
  RAISE NOTICE '  - trial_start_date';
  RAISE NOTICE '  - trial_end_date';
  RAISE NOTICE '  - subscription_status';
  RAISE NOTICE '';
  RAISE NOTICE 'system_settings テーブルを作成しました';
  RAISE NOTICE '';
  RAISE NOTICE '次のステップ:';
  RAISE NOTICE '1. あなたのユーザーアカウントのis_adminをtrueに設定';
  RAISE NOTICE '2. アプリにログインして管理画面にアクセス';
  RAISE NOTICE '3. Stripe設定を管理画面から入力';
END $$;
