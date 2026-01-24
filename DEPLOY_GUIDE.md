# 🚀 ランニング解析アプリ - Netlify デプロイ完全ガイド

## ✅ 準備完了状態

- ✅ GitHub リポジトリ: https://github.com/SusumuTakano/running-analysis-app
- ✅ 最新コミット: `576d93b` (パーン撮影 H-FVP計算 + Netlify設定)
- ✅ ビルド成功確認済み
- ✅ netlify.toml 設定済み
- ✅ パーン撮影モード完成（距離入力・開始/終了点・H-FVP計算）

---

## 📋 Netlify デプロイ手順（5分で完了）

### Step 1: Netlify にアクセス

1. https://app.netlify.com を開く
2. GitHubアカウントでログイン

### Step 2: 新しいサイトを作成

1. **「Add new site」** ボタンをクリック
2. **「Import an existing project」** を選択
3. **「Deploy with GitHub」** をクリック

### Step 3: リポジトリを選択

1. GitHub 認証を許可
2. **`SusumuTakano/running-analysis-app`** を検索して選択
3. リポジトリへのアクセスを許可

### Step 4: ビルド設定（自動検出）

以下の設定が自動で表示されます：

```
Build command: npm run build
Publish directory: dist
Branch to deploy: main
```

→ **そのまま「Next」または「Deploy」をクリック**

### Step 5: 環境変数を設定 ⚠️ 重要

デプロイ前に、以下の環境変数を設定：

| Variable Name | Value |
|--------------|-------|
| `VITE_SUPABASE_URL` | `https://fiertkuxlafeeqycywjh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | 下記手順で取得 👇 |

#### Supabase Anon Key の取得方法

1. https://supabase.com/dashboard/project/fiertkuxlafeeqycywjh にアクセス
2. 左メニュー **Settings** → **API** をクリック
3. **「anon public」** キーをコピー
4. Netlify の環境変数に貼り付け

### Step 6: デプロイ開始

1. **「Deploy site」** ボタンをクリック
2. ビルドログを確認（3-5分かかります）
3. 完了を待つ

---

## 🔧 デプロイ後の必須設定

### Supabase の URL 設定更新

デプロイが完了したら、Supabase の認証設定を更新する必要があります：

1. **Netlify のサイト URL を確認**
   - 例: `https://running-analysis-studio-xxxxx.netlify.app`

2. **Supabase ダッシュボードにアクセス**
   - https://supabase.com/dashboard/project/fiertkuxlafeeqycywjh/auth/url-configuration

3. **Site URL を設定**
   ```
   https://your-site-name.netlify.app
   ```

4. **Redirect URLs に以下を追加**（改行区切り）
   ```
   https://your-site-name.netlify.app
   https://your-site-name.netlify.app/auth/callback
   https://your-site-name.netlify.app/*
   ```

5. **「Save」** をクリック

⚠️ **この設定をしないとログイン機能が動作しません！**

---

## ✅ デプロイ確認チェックリスト

デプロイ完了後、以下を確認してください：

- [ ] サイトが表示される
- [ ] ログイン/ログアウトが動作する
- [ ] 選手登録ができる
- [ ] 動画アップロードができる
- [ ] パーン撮影モードが選択できる
- [ ] スプリットタイマーが動作する
- [ ] データが Supabase に保存される

---

## 🔄 継続的デプロイ（自動更新）

設定完了後、以下の流れで自動デプロイされます：

```
git push origin main
    ↓
GitHub に更新がプッシュされる
    ↓
Netlify が自動検知
    ↓
自動ビルド & デプロイ
    ↓
数分後にサイトが更新される
```

---

## 🐛 トラブルシューティング

### ビルドエラーが出る場合

1. Netlify のビルドログを確認
2. 環境変数が正しく設定されているか確認
3. GitHub リポジトリの最新コミットを確認

### ログインできない場合

1. Supabase の Redirect URLs 設定を確認
2. Site URL が正しいか確認
3. ブラウザのキャッシュをクリア

### 環境変数が反映されない場合

1. Netlify ダッシュボード → **Site settings** → **Environment variables**
2. 変数が正しく設定されているか確認
3. **「Trigger deploy」** → **「Deploy site」** で再デプロイ

---

## 📞 サポート

問題が解決しない場合：

1. Netlify ビルドログを確認
2. ブラウザの開発者ツール（F12）でエラーを確認
3. Supabase ダッシュボードでデータベース接続を確認

---

## 🎉 デプロイ完了！

おめでとうございます！あなたのランニング解析アプリが公開されました！

**予想される URL**: `https://running-analysis-studio.netlify.app`

次のステップ：
1. カスタムドメインを設定（オプション）
2. チームメンバーを招待
3. 本番環境でテスト実施

---

**現在の最新機能:**
- ✅ シングル固定カメラモード（詳細解析）
- ✅ パーン撮影モード（スプリットタイマー）
- ✅ 選手登録機能
- ✅ H-FVP 計算（固定カメラのみ）
- ✅ 姿勢推定・ステップ検出
- ✅ データ保存・履歴管理
