# ランニング動作解析システム

ビデオからランニングフォームを分析し、詳細なメトリクスを提供するWebアプリケーション

## 🎯 主な機能

### 分析機能
- 📹 **ビデオアップロード・分析** - ランニング動画から姿勢を検出
- 🏃 **姿勢推定** - MediaPipe Poseを使用した骨格検出
- 📊 **メトリクス計算** - ストライド、ピッチ、接地時間、滞空時間など
- 📈 **グラフ表示** - Chart.jsを使った各種データの可視化
- 💾 **データ保存** - Supabaseへの分析結果の保存

### 会員機能
- 🔐 **認証システム** - ログイン・ログアウト・新規登録
- 👤 **ユーザープロフィール** - プロフィール表示と管理
- 🎁 **ゲストアカウント** - 1週間の無料トライアル
- 💳 **有料サブスクリプション** - Stripe決済による年間プラン（500円/年）
- ⏰ **アクセス制御** - トライアル期限とサブスクリプション状態の管理

### 管理機能（管理者のみ）
- 🛡️ **管理者専用ログイン** - `/admin/login` からアクセス
- 📊 **ダッシュボード** - ユーザー統計、売上、アクティブサブスクリプション
- 👥 **ユーザー管理** - ユーザー一覧、役割変更、削除
- 💳 **Stripe設定** - APIキー、Price ID、Webhook設定
- ⚙️ **システム設定** - トライアル期間、価格設定
- 🔐 **管理者権限チェック** - ログイン時に自動的に管理者権限を確認

## 🚀 技術スタック

### フロントエンド
- **React** - UIフレームワーク
- **TypeScript** - 型安全な開発
- **Vite** - 高速ビルドツール
- **TailwindCSS** - ユーティリティファーストCSS

### バックエンド・データベース
- **Supabase** - バックエンドサービス
  - Authentication - ユーザー認証
  - Database - PostgreSQL データベース
  - Row Level Security - セキュアなデータアクセス
- **Stripe** - 決済プラットフォーム

### 分析エンジン
- **MediaPipe Pose** - 姿勢推定
- **Chart.js** - データ可視化

## 📦 プロジェクト構造

```
running-analysis-app/
├── src/
│   ├── components/
│   │   ├── Auth/           # 認証関連コンポーネント
│   │   │   ├── AuthGuard.tsx
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── UserProfile.tsx
│   │   ├── Admin/          # 管理画面コンポーネント
│   │   │   ├── AdminLayout.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── StripeSettings.tsx
│   │   │   └── UserManagement.tsx
│   │   └── Payment/        # 決済関連
│   │       └── StripeCheckout.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx # 認証コンテキスト
│   ├── pages/
│   │   ├── AuthPage.tsx    # 認証ページ
│   │   └── AdminPage.tsx   # 管理画面
│   ├── types/
│   │   ├── auth.ts         # 認証関連型定義
│   │   └── admin.ts        # 管理画面型定義
│   ├── lib/
│   │   └── supabaseClient.ts
│   ├── App.tsx             # メイン分析アプリ
│   ├── AppWithAuth.tsx     # 認証統合ルート
│   └── main.tsx
├── public/                 # 静的ファイル
├── supabase_setup.sql      # データベースセットアップSQL
├── ecosystem.config.cjs    # PM2設定
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🗄️ データベーススキーマ

### profiles テーブル
ユーザープロフィール情報
- `id` (UUID) - ユーザーID
- `email` (TEXT) - メールアドレス
- `full_name` (TEXT) - 氏名
- `role` (TEXT) - 役割（guest, paid, admin）
- `trial_start_date` (TIMESTAMPTZ) - トライアル開始日
- `trial_end_date` (TIMESTAMPTZ) - トライアル終了日
- `subscription_status` (TEXT) - サブスクリプション状態

### system_settings テーブル
システム設定
- `stripe_api_key` (TEXT) - Stripe APIキー
- `stripe_publishable_key` (TEXT) - Stripe公開可能キー
- `stripe_webhook_secret` (TEXT) - Webhook Secret
- `stripe_yearly_price_id` (TEXT) - 年間Price ID
- `trial_period_days` (INTEGER) - トライアル期間
- `subscription_price_jpy` (INTEGER) - サブスクリプション価格

### stripe_customers テーブル
Stripe顧客情報

### stripe_subscriptions テーブル
サブスクリプション情報

### running_analysis_sessions テーブル
分析セッションデータ

## 🔧 セットアップ手順

### 1. 環境変数の設定

`.env.local`ファイルを作成：

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. データベースのセットアップ

Supabaseのダッシュボードで`supabase_setup.sql`を実行：

```bash
# Supabase SQL Editorで実行
# または
supabase db push
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

### 5. ビルド

```bash
npm run build
```

## 👤 管理者アカウントの作成

1. 通常のユーザーとして登録
2. Supabaseダッシュボードで`profiles`テーブルを開く
3. 該当ユーザーの`is_admin`を`true`に変更
4. 管理者ログインページ（`/admin/login`）からログイン

### 管理者ログイン

**URL:** `/admin/login`

- 管理者専用のログインページ
- ログイン時に自動的に管理者権限をチェック
- 管理者権限がない場合はエラーメッセージを表示
- 一般ユーザーログインページへのリンクあり

## 💳 Stripe設定手順

### 1. Stripeダッシュボードでの設定

1. **Stripeアカウント作成** - https://stripe.com
2. **APIキーの取得**
   - ダッシュボード → 開発者 → APIキー
   - 公開可能キー（pk_...）とシークレットキー（sk_...）をコピー
3. **年間サブスクリプション商品の作成**
   - 商品 → 新規作成
   - 価格: 500円、請求期間: 年間
   - Price ID（price_...）をコピー
4. **Webhookの設定**
   - 開発者 → Webhook → エンドポイントを追加
   - URL: `https://your-app.com/api/stripe/webhook`
   - イベント: `customer.subscription.*` を選択
   - Webhook Secret（whsec_...）をコピー

### 2. アプリケーションでの設定

1. 管理者としてログイン
2. 管理画面 → Stripe設定
3. 以下を入力：
   - Stripe公開可能キー
   - Stripe APIキー
   - Webhook Secret
   - 年間サブスクリプション Price ID
4. 「設定を保存」をクリック

## 📊 機能詳細

### ゲストアカウント
- 1週間の無料トライアル期間
- トライアル残り日数を表示
- 期限切れ後は有料プランへのアップグレードが必要

### 有料アカウント
- 年間500円のサブスクリプション
- すべての機能を無制限に利用可能
- Stripe決済で安全な支払い

### 管理者機能
- ダッシュボードで統計情報を確認
- ユーザーの役割変更・削除
- Stripe設定の管理
- システム設定の変更

## 🔐 セキュリティ

- Supabase Row Level Security (RLS) によるデータ保護
- 管理画面は管理者のみアクセス可能
- Stripe APIキーは暗号化して保存
- 認証トークンの適切な管理

## 📝 今後の実装予定

- [ ] Stripe Webhook処理の実装
- [ ] サブスクリプション管理画面の完成
- [ ] メール通知機能
- [ ] データエクスポート機能
- [ ] 複数分析セッションの比較機能

## 🌐 デプロイ

現在の開発環境URL:
- **一般ユーザー:** https://3000-iutfhg38ul7w1p11026dx-cc2fbc16.sandbox.novita.ai
- **管理者ログイン:** https://3000-iutfhg38ul7w1p11026dx-cc2fbc16.sandbox.novita.ai/admin/login

## 📄 ライセンス

プライベートプロジェクト

## 👨‍💻 開発者

Susumu Takano
