# セットアップガイド

このガイドでは、ランニング動作解析システムの認証・決済機能を既存のSupabaseプロジェクトにセットアップする手順を説明します。

## 📋 前提条件

- Supabaseプロジェクトが既に存在する
- `profiles`テーブルが以下のスキーマで存在する：
  - `id`, `email`, `full_name`, `organization`, `role`, `organization_id`, `is_admin`, `created_at`, `updated_at`

## 🔧 ステップ1: データベースのセットアップ

### 1-1. Supabase SQL Editorを開く

1. Supabaseダッシュボードにログイン
2. 左メニューから「SQL Editor」を選択

### 1-2. セットアップSQLを実行

`supabase_setup_existing_schema.sql`の内容をコピーして実行します：

```sql
-- このファイルの内容をコピー＆ペーストして実行
```

これにより以下が追加されます：
- `profiles`テーブルへの列追加
  - `trial_start_date` - トライアル開始日
  - `trial_end_date` - トライアル終了日
  - `subscription_status` - サブスクリプション状態
- `system_settings`テーブルの作成
- RLS（Row Level Security）ポリシーの設定

## 👤 ステップ2: 管理者アカウントの設定

### 2-1. 自分のユーザーIDを確認

1. アプリケーションで新規登録またはログイン
2. Supabaseダッシュボードで「Authentication」→「Users」を開く
3. 自分のユーザーを探してUUIDをコピー

### 2-2. 管理者権限を付与

Supabaseの「Table Editor」または「SQL Editor」で実行：

```sql
-- 方法1: is_adminフィールドを使用（推奨）
UPDATE public.profiles 
SET is_admin = true 
WHERE id = 'あなたのユーザーID';

-- 方法2: roleフィールドを使用
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = 'あなたのユーザーID';

-- 両方設定してもOK
UPDATE public.profiles 
SET is_admin = true, role = 'admin' 
WHERE id = 'あなたのユーザーID';
```

### 2-3. 確認

```sql
SELECT id, email, full_name, role, is_admin 
FROM public.profiles 
WHERE id = 'あなたのユーザーID';
```

`is_admin`が`true`または`role`が`admin`になっていればOKです。

## 💳 ステップ3: Stripe設定

### 3-1. Stripeアカウントの準備

1. **Stripeアカウント作成**
   - https://stripe.com にアクセス
   - アカウントを作成

2. **APIキーの取得**
   - Stripeダッシュボード → 「開発者」→「APIキー」
   - **公開可能キー**（`pk_test_...`または`pk_live_...`）をコピー
   - **シークレットキー**（`sk_test_...`または`sk_live_...`）をコピー

### 3-2. サブスクリプション商品の作成

1. Stripeダッシュボード → 「商品」→「商品を追加」
2. 商品情報を入力：
   - 名前: ランニング動作解析システム 年間プラン
   - 説明: 年間利用プラン
3. 価格設定：
   - 価格: ¥500
   - 請求期間: 年間（yearly）
   - 通貨: JPY
4. 作成後、**Price ID**（`price_...`）をコピー

### 3-3. Webhookの設定（オプション）

1. Stripeダッシュボード → 「開発者」→「Webhook」
2. 「エンドポイントを追加」をクリック
3. エンドポイントURL: `https://your-app-domain.com/api/stripe/webhook`
4. リッスンするイベント:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. **Webhook Secret**（`whsec_...`）をコピー

### 3-4. アプリケーションで設定を入力

1. アプリケーションに管理者としてログイン
2. 右上の「🛡️ 管理画面」をクリック
3. 左メニューから「💳 Stripe設定」を選択
4. 以下の情報を入力：
   - Stripe公開可能キー: `pk_test_...` または `pk_live_...`
   - Stripe APIキー: `sk_test_...` または `sk_live_...`
   - 年間サブスクリプション Price ID: `price_...`
   - Webhook Secret: `whsec_...`（設定した場合）
5. 「設定を保存」をクリック

## ✅ ステップ4: 動作確認

### 4-1. ゲストアカウントのテスト

1. ログアウト
2. 「新規登録」をクリック
3. 「ゲストアカウント（1週間無料トライアル）」を選択
4. 登録してログイン
5. トライアル残り日数が表示されることを確認

### 4-2. 管理画面のテスト

1. 管理者アカウントでログイン
2. 「🛡️ 管理画面」が表示されることを確認
3. ダッシュボードでユーザー統計が表示されることを確認
4. ユーザー管理でユーザー一覧が表示されることを確認

### 4-3. Stripe決済のテスト（オプション）

1. ゲストアカウントまたはテストユーザーでログイン
2. 「有料プランにアップグレード」をクリック
3. Stripe Checkoutページに遷移することを確認
4. テストカード番号（`4242 4242 4242 4242`）で決済テスト

## 🔍 トラブルシューティング

### 管理画面が表示されない

**原因**: 管理者権限が正しく設定されていない

**解決方法**:
```sql
-- 確認
SELECT id, email, is_admin, role FROM public.profiles WHERE email = 'your-email@example.com';

-- 修正
UPDATE public.profiles SET is_admin = true WHERE email = 'your-email@example.com';
```

### Stripe設定が保存できない

**原因**: RLSポリシーが正しく設定されていない、または管理者権限がない

**解決方法**:
```sql
-- RLSポリシーを確認
SELECT * FROM pg_policies WHERE tablename = 'system_settings';

-- 必要に応じて再実行
-- supabase_setup_existing_schema.sqlのRLS設定部分を再実行
```

### ユーザー一覧が表示されない

**原因**: profilesテーブルへのアクセス権限がない

**解決方法**:
```sql
-- profilesテーブルのRLSポリシーを確認
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- 必要に応じてSELECTポリシーを追加
CREATE POLICY "管理者は全ユーザーを参照可能" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS admin_profile
      WHERE admin_profile.id = auth.uid()
      AND (admin_profile.is_admin = true OR admin_profile.role = 'admin')
    )
  );
```

## 📚 次のステップ

セットアップが完了したら：

1. **ユーザーを招待** - 既存アプリのユーザーに新しいアプリを案内
2. **Stripe本番環境への切り替え** - テストが完了したら本番APIキーに切り替え
3. **Webhook処理の実装** - サブスクリプションイベントの自動処理
4. **メール通知の設定** - Supabaseのメールテンプレートをカスタマイズ

## 💡 補足情報

### roleとis_adminの使い分け

このアプリでは両方をサポートしています：

- **is_admin = true**: 管理者フラグ（既存スキーマに合わせて使用）
- **role = 'admin'**: 役割ベースの管理者判定

どちらか一方、または両方が設定されていれば管理者として認識されます。

### トライアル期間のカスタマイズ

管理画面の「Stripe設定」から変更できます：
- デフォルト: 7日間
- 設定可能範囲: 1〜30日

変更は新規登録ユーザーから適用されます。

## 🆘 サポート

問題が解決しない場合は、以下を確認してください：

1. ブラウザの開発者ツール（F12）でコンソールエラーを確認
2. Supabaseダッシュボードの「Logs」でエラーログを確認
3. `.env.local`ファイルが正しく設定されているか確認

---

**セットアップガイドの更新日**: 2024年11月24日
