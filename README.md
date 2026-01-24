# ランニング動作解析システム

ビデオからランニングフォームを分析し、詳細なメトリクスを提供するWebアプリケーション

## 🎯 主な機能

### 分析機能
- 📹 **ビデオアップロード・分析** - ランニング動画から姿勢を検出
- 🎬 **FPS選択（60fps/120fps）** - 通常60fps、条件が良い場合は120fpsの高精度モード
- 🏃 **姿勢推定** - MediaPipe Poseを使用した骨格検出
- 📊 **メトリクス計算** - ストライド、ピッチ、接地時間、滞空時間など
- ⚡ **ブレーキ/キック比率** - 接地中の減速・加速の比率を計算（時間比率・速度変化量比率）
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

### 2. データベースのセットアップ（必須）

**⚠️ 重要：必ずこの手順を実行してください**

Supabaseダッシュボードで以下のSQLを実行：

#### 手順：
1. **Supabaseダッシュボードにログイン**
   - https://supabase.com/dashboard にアクセス
   - プロジェクトを選択

2. **SQL Editorを開く**
   - 左メニュー → `SQL Editor` → `New Query`

3. **supabase_setup_final.sql の内容を実行**
   - ⚠️ 既存のデータがある場合は削除されます
   - ファイル内のすべてのSQLをコピー＆ペースト
   - `Run` をクリック

4. **成功確認**
   - エラーがないことを確認
   - 最後の確認クエリで `user_profiles` テーブルの列とポリシーが表示されることを確認

#### このSQLで作成されるもの：
- ✅ `user_profiles` テーブル（名前、かな、性別、生年月日、年齢、身長、都道府県、所属）
- ✅ 更新日時自動更新トリガー
- ✅ RLS（Row Level Security）ポリシー
- ✅ テーブル権限設定
- ✅ デベロッパー版期限チェック関数（2025年12月31日まで有効）

**注意：** このSQL実行なしではログインできません！

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

### Netlifyへのデプロイ手順

1. **Netlifyアカウントにログイン**
   - https://app.netlify.com にアクセス

2. **新しいサイトを追加**
   - "Add new site" → "Import an existing project" をクリック
   - "Deploy with GitHub" を選択

3. **GitHubリポジトリを選択**
   - `SusumuTakano/running-analysis-app` を選択

4. **ビルド設定（自動検出されます）**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 18

5. **環境変数の設定**
   - Site configuration → Environment variables
   - 以下の変数を追加：
     ```
     VITE_SUPABASE_URL=your-supabase-url
     VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
     ```

6. **デプロイ**
   - "Deploy site" をクリック
   - 自動的にビルドとデプロイが開始されます

### 自動デプロイ

- `main` ブランチへのプッシュで自動デプロイ
- プルリクエストごとにプレビューデプロイ生成

### デプロイURL

デプロイ後、以下のようなURLでアクセス可能：
- **本番:** `https://your-app-name.netlify.app`
- **管理者ログイン:** `https://your-app-name.netlify.app/admin/login`

### 開発環境URL（Sandbox）:
- **一般ユーザー:** https://3000-iutfhg38ul7w1p11026dx-cc2fbc16.sandbox.novita.ai
- **管理者ログイン:** https://3000-iutfhg38ul7w1p11026dx-cc2fbc16.sandbox.novita.ai/admin/login

## 🎥 推奨撮影条件

### iPhone推奨設定
- **60fpsモード（標準）**: `1080p HD / 60 fps`
  - 日常のトレーニング解析に最適
  - 処理速度: 約30秒
  - メモリ使用量: 約200MB
  
- **120fpsモード（高精度）**: `1080p HD / 120 fps`
  - 条件が良い場合（明るい・手ブレなし）
  - 接地時間、ブレーキ率・キック率の超高精度測定
  - 処理速度: 約120秒
  - メモリ使用量: 約400MB

### 撮影のポイント
- 📏 **距離**: 5〜10m（人物が画面の50〜70%を占める）
- 📐 **高さ**: 1m（腰の高さ）
- 🎬 **タイミング**: スタートの2〜3秒前から撮影開始
- 📱 **固定**: 三脚使用推奨
- ☀️ **照明**: 明るい環境（日中の屋外など）
- 🎨 **背景**: シンプルな背景（トラック、運動場など）

### FPS選択の目安
- **60fps**: ピッチ、ストライド、姿勢角度の解析に十分
- **120fps**: 接地時間（0.08〜0.12秒）の高精度測定、ブレーキ率・キック率の詳細解析

## ⚡ ブレーキ/キック比率について

### 計算方法
接地中の重心（腰の中心）の水平速度から、減速（ブレーキ）と加速（キック）の比率を計算します。

#### 2種類の比率
1. **時間比率（Time Ratio）**
   - 接地中に減速/加速している時間の割合
   - 例：ブレーキ時間比率 60% = 接地中の60%の時間で減速

2. **速度変化量比率（Impulse Ratio）** ⭐推奨
   - 減速/加速の速度変化量の比率
   - より実際の力積を反映
   - 表示されるのはこちらの値

### 理想的な値
- **ブレーキ率**: 40〜50%（低い方が効率的）
- **キック率**: 50〜60%（高い方が推進力が大きい）

### 解釈のポイント
- **ブレーキ率が高い（55%以上）**: 接地初期のブレーキが大きい → フォーム改善の余地
- **キック率が高い（55%以上）**: 推進力が効率的 → 良好なフォーム
- **ブレーキ率 ≈ キック率**: バランス型（万能タイプ）

### 注意事項
- **120fps推奨**: 接地時間が短いため、60fpsでは精度が低下する可能性
- **接地・離地データ必須**: 接地のみモードでは計算できません（ピッチとストライドのみ）
- **カメラ固定**: パン撮影では重心移動が正確に計算できません

## 🎯 検出モード

### モード1: 接地・離地とも手動入力【最も正確・推奨】
- **解析内容**: 接地時間、ブレーキ率、キック率、ピッチ、ストライド
- **精度**: 最高精度
- **推奨用途**: すべての解析（特にブレーキ/キック率の解析に必須）

### モード2: 接地のみ手動入力（離地は自動）
- **解析内容**: ピッチ、ストライドのみ
- **精度**: 中程度
- **推奨用途**: 簡易的なピッチ・ストライド確認
- **制限事項**: 接地時間、ブレーキ率、キック率は非対応

## 🌐 Netlify デプロイ

### 自動デプロイ（推奨）

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/SusumuTakano/running-analysis-app)

1. **上記ボタンをクリック**
2. **GitHubと連携**
3. **リポジトリを選択**
4. **環境変数を設定**:
   - `VITE_SUPABASE_URL`: Supabaseプロジェクトの URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase の anon キー
5. **Deploy site** をクリック

### 手動デプロイ

#### 1. Netlify CLI のインストール

```bash
npm install -g netlify-cli
```

#### 2. Netlify にログイン

```bash
netlify login
```

#### 3. 初回デプロイ

```bash
# ビルド
npm run build

# デプロイ
netlify deploy --prod
```

#### 4. 環境変数の設定

Netlify Dashboard で以下を設定：

- `VITE_SUPABASE_URL`: `https://fiertkuxlafeeqycywjh.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: [Supabase Dashboard から取得]

**設定場所**: Site settings → Environment variables

### デプロイ後の確認事項

1. **Supabase の設定**
   - Netlify のドメインを Supabase の許可リストに追加
   - Authentication → URL Configuration
   - Site URL と Redirect URLs を更新

2. **動作確認**
   - ログイン/ログアウト
   - 動画アップロード
   - 姿勢推定
   - データ保存

### トラブルシューティング

#### ビルドエラー

```bash
# ローカルでビルドテスト
npm run build

# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install
```

#### 環境変数が反映されない

- Netlify Dashboard で環境変数を確認
- 再デプロイを実行: `Deploys → Trigger deploy → Deploy site`

#### SPA ルーティングが動作しない

- `netlify.toml` のリダイレクト設定を確認
- すでに設定済み（`/* → /index.html`）

## 📄 ライセンス

プライベートプロジェクト

## 👨‍💻 開発者

Susumu Takano
