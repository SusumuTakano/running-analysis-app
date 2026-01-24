# 🚀 Netlify 手動デプロイ手順

## 📋 準備事項

- **GitHubリポジトリ**: https://github.com/SusumuTakano/running-analysis-app
- **最新コミット**: `9d2d89e`
- **機能**: パーン撮影モード + H-FVP計算完成

---

## 🎯 Netlify UIでのデプロイ手順（5分）

### Step 1: Netlifyにログイン

1. **Netlify**: https://app.netlify.com にアクセス
2. **GitHubアカウント**でログイン

### Step 2: 新しいサイトを作成

1. 右上の **「Add new site」** をクリック
2. **「Import an existing project」** を選択

### Step 3: GitHubと連携

1. **「Deploy with GitHub」** を選択
2. GitHub認証画面が表示されたら **「Authorize Netlify」** をクリック
3. リポジトリへのアクセスを許可

### Step 4: リポジトリを選択

1. 検索ボックスに **`running-analysis-app`** と入力
2. **`SusumuTakano/running-analysis-app`** を選択
3. **「Deploy site」** をクリック前に環境変数を設定

### Step 5: 環境変数を設定 ⚠️ 重要

デプロイ前に、「Site configuration」または「Advanced」セクションで環境変数を追加：

#### 必須の環境変数

| Variable Name | Value |
|--------------|-------|
| `VITE_SUPABASE_URL` | `https://fiertkuxlafeeqycywjh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | 👇 下記手順で取得 |

#### Supabase Anon Keyの取得方法

1. **Supabase Dashboard**: https://supabase.com/dashboard/project/fiertkuxlafeeqycywjh にアクセス
2. 左メニューから **「Settings」** → **「API」** をクリック
3. **「Project API keys」** セクションの **「anon public」** キーをコピー
4. Netlifyの環境変数 `VITE_SUPABASE_ANON_KEY` に貼り付け

### Step 6: ビルド設定を確認

`netlify.toml` があるため、自動的に以下の設定が適用されます：

```toml
Build command: npm run build
Publish directory: dist
Node version: 20
```

→ **そのまま「Deploy」をクリック**

### Step 7: デプロイ開始

1. **「Deploy site」** ボタンをクリック
2. ビルドプロセスが開始されます（約2-3分）
3. ビルドログをリアルタイムで確認できます

### Step 8: デプロイ完了

デプロイが成功すると：

- ✅ **サイトURL**: `https://your-site-name.netlify.app`
- ✅ **本番環境**: 自動的に公開
- ✅ **自動デプロイ**: 今後mainブランチへのpushで自動更新

---

## 🔧 デプロイ後の設定

### Supabase URL設定

Supabaseの認証を正しく動作させるため：

1. **Supabase Dashboard**: https://supabase.com/dashboard/project/fiertkuxlafeeqycywjh/auth/url-configuration
2. **Site URL** に Netlify サイトURL を設定:
   - 例: `https://your-site-name.netlify.app`
3. **Redirect URLs** に以下を追加:
   ```
   https://your-site-name.netlify.app
   https://your-site-name.netlify.app/auth/callback
   https://your-site-name.netlify.app/*
   ```
4. **「Save」** をクリック

---

## ✅ デプロイ確認チェックリスト

- [ ] サイトが正常に表示される
- [ ] 選手情報入力フォームが動作する
- [ ] パーン撮影モードが選択できる
- [ ] 動画アップロードが正常に動作する
- [ ] スプリット追加機能が動作する
- [ ] 開始・終了点の選択ができる
- [ ] H-FVP計算結果が表示される
- [ ] Supabase認証が動作する（ログイン/ログアウト）

---

## 🚨 トラブルシューティング

### ビルドエラーが発生する場合

1. **環境変数を確認**:
   - `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が正しく設定されているか
2. **Node.jsバージョンを確認**:
   - netlify.toml で Node 20 を指定済み
3. **ビルドログを確認**:
   - Netlify UI の「Deploys」→ 最新デプロイ → 「Build log」

### サイトは表示されるがSupabaseに接続できない

1. **環境変数を再確認**:
   - Netlify Site settings → Environment variables
2. **Supabase URLを確認**:
   - Supabase Dashboard → Settings → API → Project URL
3. **Redeploy**:
   - 環境変数を更新した後、Netlify UIから「Trigger deploy」

---

## 📞 サポート

問題が解決しない場合：

1. **Netlifyビルドログ**を確認
2. **ブラウザのコンソールログ**を確認
3. **Supabase認証設定**を再確認

---

🎉 **デプロイが成功したら、URLを共有してテストしてください！**
