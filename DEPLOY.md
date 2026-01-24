# 🚀 Running Analysis Studio - デプロイガイド

## Netlify デプロイ手順

### 方法1: Netlify Dashboard（推奨・最も簡単）⭐

#### 1. Netlifyにアクセス
https://app.netlify.com

#### 2. 新しいサイトを作成
- 「Add new site」→「Import an existing project」
- 「Deploy with GitHub」を選択

#### 3. リポジトリを選択
- GitHub アカウントと連携
- `SusumuTakano/running-analysis-app` を選択

#### 4. ビルド設定（自動検出）
```
Build command: npm run build
Publish directory: dist
```
→ netlify.toml が自動検出されます

#### 5. 環境変数を設定

**必須の環境変数**:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://fiertkuxlafeeqycywjh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | [Supabaseから取得] |

**Supabase Anon Key の取得**:
1. https://supabase.com/dashboard/project/fiertkuxlafeeqycywjh
2. Settings → API
3. 「anon public」キーをコピー

#### 6. デプロイ開始
「Deploy site」をクリック → 完了を待つ（3-5分）

---

### 方法2: Netlify CLI（コマンドライン）

#### 前提条件
```bash
cd /home/user/webapp
npm install
```

#### デプロイコマンド

**本番デプロイ**:
```bash
npm run deploy
```

**プレビューデプロイ（テスト用）**:
```bash
npm run deploy:preview
```

#### 初回セットアップ
```bash
# Netlify にログイン
npx netlify login

# サイトを初期化
npx netlify init
```

プロンプトで以下を選択：
- Create & configure a new site
- Team: [あなたのチーム]
- Site name: running-analysis-studio（または任意の名前）

---

## デプロイ後の設定

### 1. Supabase の設定更新

#### Authentication → URL Configuration
https://supabase.com/dashboard/project/fiertkuxlafeeqycywjh/auth/url-configuration

**Site URL**:
```
https://your-site-name.netlify.app
```

**Redirect URLs** (改行区切りで追加):
```
https://your-site-name.netlify.app
https://your-site-name.netlify.app/auth/callback
https://your-site-name.netlify.app/*
```

### 2. カスタムドメイン（オプション）

Netlify Dashboard で設定:
- Domain settings → Add custom domain
- 独自ドメイン（例: `running-analysis.example.com`）を入力
- DNS設定を更新（CNAMEレコード）
- HTTPS 自動有効化

---

## 環境変数の管理

### Netlify Dashboard で設定
1. Site settings → Environment variables
2. 「Add a variable」をクリック
3. キーと値を入力
4. 「Save」

### 更新後の再デプロイ
環境変数を変更した後は：
- Deploys → Trigger deploy → Deploy site

---

## トラブルシューティング

### ビルドエラー

**症状**: Build failed

**対処**:
```bash
# ローカルでビルドテスト
npm run build

# エラーが出たら
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 環境変数エラー

**症状**: "Supabase client initialization failed"

**対処**:
1. Netlify Dashboard → Environment variables を確認
2. `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が正しいか確認
3. 再デプロイ

### ルーティングエラー

**症状**: リロードすると 404

**対処**:
- `netlify.toml` のリダイレクト設定を確認
- 既に設定済み: `/* → /index.html (200)`

### CORS エラー

**症状**: Supabase API がブロックされる

**対処**:
1. Supabase Dashboard → Authentication → URL Configuration
2. Netlify のドメインを追加
3. Redirect URLs を更新

---

## デプロイ状況の確認

### Netlify Dashboard
- Deploys タブで履歴を確認
- Production deploys → 現在のライブ版
- Deploy logs → ビルドログを確認

### CLI で確認
```bash
npx netlify status
npx netlify open
```

---

## 継続的デプロイ（自動デプロイ）

GitHub の `main` ブランチに push すると自動的に：
1. Netlify がコミットを検知
2. ビルドを実行（`npm run build`）
3. デプロイを実施
4. 完了通知

**完全自動化！** 🎉

---

## デプロイ完了後

デプロイが成功すると、以下のような URL が発行されます：

```
Production URL: https://running-analysis-studio.netlify.app
Deploy Preview: https://deploy-preview-123--running-analysis-studio.netlify.app
```

この URL をユーザーに共有！

---

## サポート

問題が発生した場合:
- Netlify Docs: https://docs.netlify.com
- Supabase Docs: https://supabase.com/docs
- GitHub Issues: https://github.com/SusumuTakano/running-analysis-app/issues
