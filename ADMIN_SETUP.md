# 管理者権限の付与方法

このガイドでは、Supabaseで管理者権限を付与する具体的な手順を説明します。

## 🎯 前提条件

- アプリケーションでユーザー登録が完了している
- Supabaseプロジェクトへのアクセス権限がある

---

## 📋 方法1: Table Editor から設定（最も簡単）

### ステップ1: Supabaseダッシュボードにアクセス

1. ブラウザで https://supabase.com/dashboard を開く
2. ログイン
3. 対象のプロジェクトを選択

### ステップ2: Table Editorを開く

1. 左メニューから **「Table Editor」** をクリック
2. テーブル一覧から **`profiles`** を選択

### ステップ3: 自分のユーザーを探す

**方法A: フィルター機能を使う**
1. 上部の検索ボックスに自分のメールアドレスを入力
2. `email` 列で該当するレコードが表示される

**方法B: 最新のレコードを確認**
1. `created_at` 列で降順にソート（新しい順）
2. 最近作成されたレコードを確認

### ステップ4: is_admin を true に変更

1. 該当するユーザーの行を見つける
2. `is_admin` 列をクリック
3. チェックボックスをオン（✅）にする
4. Enter キーを押すか、別のセルをクリックして保存

**完了！** アプリをリロードすると「🛡️ 管理画面」が表示されます。

---

## 📋 方法2: SQL Editor から設定（確実）

### ステップ1: SQL Editorを開く

1. 左メニューから **「SQL Editor」** をクリック
2. 「New query」をクリック

### ステップ2: SQLを実行

以下のSQLをコピー＆ペーストして実行：

```sql
-- メールアドレスで管理者権限を付与
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'your-email@example.com';
```

**または、ユーザーIDで指定する場合：**

```sql
-- まず自分のユーザーIDを確認
SELECT id, email, full_name, is_admin, role 
FROM public.profiles 
WHERE email = 'your-email@example.com';

-- ユーザーIDで管理者権限を付与
UPDATE public.profiles 
SET is_admin = true 
WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
```

### ステップ3: 確認

```sql
-- 設定が反映されたか確認
SELECT id, email, full_name, is_admin, role 
FROM public.profiles 
WHERE email = 'your-email@example.com';
```

`is_admin` が `true` になっていればOK！

---

## 📋 方法3: Authentication から確認

### ユーザーIDの確認方法

1. 左メニューから **「Authentication」** → **「Users」** をクリック
2. 自分のメールアドレスを探す
3. ユーザー行をクリックして詳細を表示
4. **UUID（ユーザーID）** をコピー

その後、方法2のSQLでユーザーIDを使って更新します。

---

## ✅ 動作確認

### 1. アプリケーションで確認

1. アプリケーションにログイン（またはリロード）
2. 右上のナビゲーションに **「🛡️ 管理画面」** ボタンが表示される
3. クリックして管理画面にアクセスできる

### 2. ダッシュボードの確認

管理画面にアクセスできたら：
- ダッシュボードで統計情報が表示される
- ユーザー管理でユーザー一覧が表示される
- Stripe設定にアクセスできる

---

## 🔧 トラブルシューティング

### 問題: 管理画面が表示されない

**チェック項目:**

1. **is_admin が本当に true になっているか確認**
   ```sql
   SELECT email, is_admin, role FROM public.profiles 
   WHERE email = 'your-email@example.com';
   ```

2. **ブラウザのキャッシュをクリア**
   - Ctrl+Shift+Delete (Windows/Linux)
   - Cmd+Shift+Delete (Mac)

3. **完全にログアウト→ログインし直す**
   - アプリでログアウト
   - 再度ログイン

4. **RLSポリシーを確認**
   ```sql
   -- system_settingsテーブルのポリシーを確認
   SELECT * FROM pg_policies 
   WHERE tablename = 'system_settings';
   ```

### 問題: SQLエラーが出る

**エラー: `permission denied for table profiles`**

→ Supabaseのサービスロールキーを使用するか、RLSポリシーを一時的に無効化：

```sql
-- 一時的にRLSを無効化（注意：必ず後で有効化すること）
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 更新
UPDATE public.profiles SET is_admin = true WHERE email = 'your-email@example.com';

-- RLSを再度有効化
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

---

## 💡 補足: 複数の管理者を追加

複数の管理者を設定する場合：

```sql
-- 複数のメールアドレスを一度に設定
UPDATE public.profiles 
SET is_admin = true 
WHERE email IN (
  'admin1@example.com',
  'admin2@example.com',
  'admin3@example.com'
);

-- 確認
SELECT email, full_name, is_admin, role 
FROM public.profiles 
WHERE is_admin = true;
```

---

## 🔐 セキュリティのベストプラクティス

1. **最小限の管理者** - 必要最低限の人数だけに権限を付与
2. **定期的な確認** - 管理者リストを定期的に確認
3. **権限の剥奪** - 退職者や不要になった管理者の権限を削除

```sql
-- 管理者権限を剥奪
UPDATE public.profiles 
SET is_admin = false 
WHERE email = 'former-admin@example.com';
```

---

## 📊 現在の管理者を確認

```sql
-- 現在の管理者一覧
SELECT 
  email, 
  full_name, 
  is_admin, 
  role,
  created_at 
FROM public.profiles 
WHERE is_admin = true OR role = 'admin'
ORDER BY created_at DESC;
```

---

## 🆘 それでも解決しない場合

1. **ブラウザのコンソールを確認**
   - F12 → Console タブ
   - エラーメッセージを確認

2. **Supabaseのログを確認**
   - Supabaseダッシュボード → Logs
   - エラーログを確認

3. **環境変数を確認**
   - `.env.local` が正しく設定されているか
   - `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が正しいか

---

**最終更新**: 2024年11月24日
