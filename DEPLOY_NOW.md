# 🚀 即座にデプロイする方法（3分）

## 準備完了状態

- ✅ ビルド完成: `dist/` ディレクトリ
- ✅ コミット: `210e300` (パーン撮影モード簡素化)
- ✅ GitHub: https://github.com/SusumuTakano/running-analysis-app

---

## 方法1: Netlify Drop（最速・認証不要）

### Step 1: アーカイブをダウンロード

サンドボックスから `netlify-deploy.tar.gz` をダウンロード：

```bash
# ファイルパス
/home/user/webapp/netlify-deploy.tar.gz
```

### Step 2: 解凍

ローカルPCで解凍：
```bash
tar -xzf netlify-deploy.tar.gz -C deploy-folder/
```

### Step 3: Netlify Dropにアップロード

1. **Netlify Drop**: https://app.netlify.com/drop にアクセス
2. 解凍したフォルダをドラッグ&ドロップ
3. 数秒でデプロイ完了！
4. URLが表示される: `https://random-name.netlify.app`

### Step 4: 環境変数を設定

デプロイ後、Netlify UI で環境変数を設定：

1. Site settings → Environment variables
2. 以下を追加:
   ```
   VITE_SUPABASE_URL = https://fiertkuxlafeeqycywjh.supabase.co
   VITE_SUPABASE_ANON_KEY = [Supabaseから取得]
   ```
3. **Trigger deploy** をクリックして再デプロイ

---

## 方法2: Netlify UI から GitHub連携（推奨）

### Step 1: Netlify にアクセス

https://app.netlify.com にログイン

### Step 2: 新しいサイトを作成

1. **「Add new site」** → **「Import an existing project」**
2. **「Deploy with GitHub」** を選択
3. `SusumuTakano/running-analysis-app` を選択

### Step 3: ビルド設定

以下が自動検出されます（`netlify.toml` により）:
```
Build command: npm run build
Publish directory: dist
Branch: main
```

### Step 4: 環境変数を設定

デプロイ前に環境変数を追加：

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://fiertkuxlafeeqycywjh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabaseから取得 👇 |

**Supabase Anon Keyの取得**:
1. https://supabase.com/dashboard/project/fiertkuxlafeeqycywjh
2. Settings → API
3. 「anon public」キーをコピー

### Step 5: デプロイ実行

**「Deploy site」** をクリック → 2-3分で完了

### Step 6: 自動デプロイ設定

今後、`main`ブランチへの`git push`で自動デプロイされます！

---

## 方法3: Vercel（代替案）

### Vercelでのデプロイ

1. **Vercel**: https://vercel.com にアクセス
2. **「Add New」** → **「Project」**
3. GitHub連携: `SusumuTakano/running-analysis-app` を選択
4. ビルド設定:
   ```
   Build Command: npm run build
   Output Directory: dist
   ```
5. 環境変数を追加（上記と同じ）
6. **「Deploy」** をクリック

---

## ✅ デプロイ後の確認

デプロイが完了したら：

- [ ] サイトにアクセスできる
- [ ] 選手情報入力が動作
- [ ] パーン撮影モードが選択可能
- [ ] 動画アップロードが成功
- [ ] スプリット追加が動作
- [ ] H-FVP計算結果が表示

---

## 🎯 推奨方法

### 初回デプロイ: **Netlify UI + GitHub連携（方法2）**
- 自動デプロイ設定
- GitHubからのビルド
- 環境変数管理が簡単

### 緊急デプロイ: **Netlify Drop（方法1）**
- 最速（3分）
- 認証不要
- ビルド済みファイルを直接アップロード

---

## 💡 デプロイ完了後

### Supabase URL設定

1. **Supabase Dashboard**: https://supabase.com/dashboard/project/fiertkuxlafeeqycywjh/auth/url-configuration
2. **Site URL** にNetlify URLを設定
3. **Redirect URLs** に以下を追加:
   ```
   https://your-site-name.netlify.app
   https://your-site-name.netlify.app/auth/callback
   https://your-site-name.netlify.app/*
   ```

---

🚀 **今すぐデプロイして、パーン撮影モードをテストしましょう！**
