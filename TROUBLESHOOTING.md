# トラブルシューティングガイド

## ログインできない場合

### 症状1: ログイン中のまま止まる

**原因:**
- Supabaseのプロフィールテーブルが未設定
- RLSポリシーがブロックしている
- ネットワーク接続の問題

**解決方法:**

1. **Supabaseでプロフィール確認**
```sql
SELECT COUNT(*) FROM public.user_profiles;
```

2. **プロフィールが0件の場合**
   - `supabase_create_all_profiles.sql` を実行

3. **RLS確認**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_profiles';
```

4. **RLSが有効な場合**
   - `supabase_rls_minimal.sql` を実行してRLSを無効化

---

### 症状2: ブラウザ拡張機能のエラーが表示される

**症状:**
- コンソールに `background.js:1` のエラーが大量に表示
- `Unchecked runtime.lastError` エラー

**原因:**
- Chrome拡張機能（広告ブロッカー、プライバシー保護など）の干渉

**解決方法:**

#### 方法1: シークレットモード（推奨）
1. Chromeのシークレットウィンドウを開く
2. アプリにアクセス
3. ログインを試す

#### 方法2: 拡張機能を一時的に無効化
1. Chrome設定 → 拡張機能
2. すべての拡張機能を無効化
3. アプリにアクセス

#### 方法3: 別のブラウザを使用
- Safari
- Firefox
- Edge

---

### 症状3: ログイン成功後に画面が真っ白

**原因:**
- Reactのレンダリングエラー
- プロフィールデータの型不一致

**解決方法:**

1. **コンソールログを確認**
   - React エラーメッセージを探す
   - `Minified React error` が表示されているか

2. **プロフィールデータを確認**
```sql
SELECT p.*, u.email
FROM public.user_profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.email = 'your-email@example.com';
```

3. **必須フィールドが NULL の場合**
```sql
UPDATE public.user_profiles
SET 
  name = COALESCE(name, (SELECT email FROM auth.users WHERE id = user_profiles.id)),
  height_cm = COALESCE(height_cm, 170.0)
WHERE name IS NULL OR height_cm IS NULL;
```

---

## Netlifyデプロイ後にログインできない

### 環境変数の確認

**Netlify Dashboard → Site settings → Environment variables**

必要な環境変数:
```
VITE_SUPABASE_URL=https://fiertkuxlafeeqycywjh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 環境変数が設定されていない場合

1. Netlify Dashboard にログイン
2. Site settings → Environment variables
3. 上記の2つの変数を追加
4. Save
5. Deploys → Trigger deploy → Deploy site

---

## iPhoneでログインできない

### ブラウザキャッシュのクリア

**Safari:**
1. 設定アプリを開く
2. Safari → 詳細 → Webサイトデータ
3. 全Webサイトデータを削除

**Chrome:**
1. Chrome設定
2. プライバシーとセキュリティ
3. 閲覧履歴データの削除
4. キャッシュされた画像とファイル

### プライベートブラウズモード

1. Safariを開く
2. タブボタン長押し
3. 「プライベート」を選択
4. 新しいタブでアプリを開く

---

## デバッグ用URL

### サンドボックス環境（常に最新）
https://3000-iutfhg38ul7w1p11026dx-cc2fbc16.sandbox.novita.ai

- 開発環境
- 最新のコードが反映
- デバッグログが有効

### 本番環境（Netlify）
https://your-app.netlify.app

- 本番環境
- GitHubプッシュ後に自動デプロイ
- 環境変数の設定が必要

---

## コンソールログの確認方法

### デスクトップ（Chrome/Safari）
1. F12キーまたは右クリック → 検証
2. Console タブを選択
3. エラーメッセージを確認

### iPhone（Safari + Mac）
1. iPhone: 設定 → Safari → 詳細 → Webインスペクタ: ON
2. iPhoneをMacにUSB接続
3. Mac Safari → 開発 → [iPhoneデバイス名] → [タブ]
4. コンソールでログを確認

---

## 正常なログインのコンソールログ

```javascript
Supabase client initialized successfully
Supabase URL: https://fiertkuxlafeeqycywjh.supabase.co
Login attempt for: your-email@example.com
Attempting login with Supabase...
Start time: 2025-11-25T...
Login successful, user ID: df1b9fc6-fb3a-4f9e-884d-...
Fetching user profile...
Getting profile for user: df1b9fc6-fb3a-4f9e-884d-...
✅ Profile loaded successfully: your-email@example.com
Login completed at: 2025-11-25T...
```

---

## よくある質問

### Q: パスワードを忘れた
**A:** 現在、パスワードリセット機能は未実装です。新しいアカウントを作成してください。

### Q: メールアドレスが既に使用されている
**A:** そのメールアドレスは既に登録されています。ログインしてください。

### Q: 登録しても確認メールが届かない
**A:** Email確認は無効化されています。登録後すぐにログインできます。

### Q: ログイン後に何も表示されない
**A:** ブラウザキャッシュをクリアして再度試してください。

---

## サポート

問題が解決しない場合は、以下の情報を添えてお問い合わせください：

1. 使用しているデバイス（iPhone、PC、Mac）
2. ブラウザ（Safari、Chrome、Firefox）
3. エラーメッセージのスクリーンショット
4. コンソールログ（可能な場合）
