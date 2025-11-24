# 🚀 クイックスタートガイド

5分で管理画面を使い始めるための最短手順です。

## ⚡ 最速セットアップ（3ステップ）

### ステップ1️⃣: データベースをセットアップ（1分）

1. Supabaseダッシュボードを開く → **SQL Editor**
2. 以下のコードをコピー＆ペースト → **Run**

```sql
-- 既存profilesテーブルに列を追加
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT;

-- system_settingsテーブルを作成
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

-- RLS設定
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select" ON public.system_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_admin = true OR profiles.role = 'admin')
  ));

CREATE POLICY "admin_update" ON public.system_settings FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_admin = true OR profiles.role = 'admin')
  ));

CREATE POLICY "admin_insert" ON public.system_settings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_admin = true OR profiles.role = 'admin')
  ));

-- 初期設定
INSERT INTO public.system_settings (trial_period_days, subscription_price_jpy, app_name)
SELECT 7, 500, 'ランニング動作解析システム'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);
```

✅ 成功メッセージが表示されたら完了！

---

### ステップ2️⃣: 管理者権限を付与（30秒）

#### 方法A: Table Editor から（簡単）

1. **Table Editor** → **profiles** テーブルを開く
2. 自分のメールアドレスの行を探す
3. **is_admin** 列をクリック → チェックを入れる ✅
4. Enter キー → 保存完了！

#### 方法B: SQL から（確実）

SQL Editorで実行：

```sql
-- ⚠️ your-email@example.com を自分のメールに変更！
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'your-email@example.com';

-- 確認
SELECT email, is_admin FROM public.profiles WHERE email = 'your-email@example.com';
```

`is_admin` が `true` と表示されればOK！

---

### ステップ3️⃣: アプリで確認（30秒）

1. アプリケーションにアクセス
2. ログイン（またはF5でリロード）
3. 右上に **「🛡️ 管理画面」** ボタンが表示される
4. クリック → 管理画面にアクセス！

**🎉 完了！ダッシュボードが表示されます！**

---

## 📊 次にやること

### 1. Stripe設定（オプション・決済機能が必要な場合）

管理画面 → 💳 Stripe設定 → 以下を入力：

```
✅ Stripe公開可能キー: pk_test_xxxxxxxxxx
✅ Stripe APIキー: sk_test_xxxxxxxxxx  
✅ 年間Price ID: price_xxxxxxxxxx
```

**Stripeアカウントがない場合：**
1. https://stripe.com で無料登録
2. ダッシュボード → 開発者 → APIキー → コピー
3. 商品 → 新規作成 → ¥500/年 → Price IDをコピー

### 2. テストユーザーを作成

1. 別のブラウザ（プライベートモード）で開く
2. 新規登録 → ゲストアカウント選択
3. 登録完了 → トライアル開始！

### 3. 管理画面で確認

- 📊 **ダッシュボード** → ユーザー数が増えている
- 👥 **ユーザー管理** → 新規ユーザーが表示される

---

## 🎯 よくある質問

### Q: 管理画面ボタンが表示されない

**A: 以下を確認してください：**

1. ログアウト → ログインし直す
2. ブラウザのキャッシュをクリア（Ctrl+Shift+Delete）
3. `is_admin` が本当に `true` か確認：
   ```sql
   SELECT email, is_admin FROM public.profiles WHERE email = 'your@email.com';
   ```

### Q: 「アクセス拒否」と表示される

**A: RLSポリシーの問題です。以下を実行：**

```sql
-- ポリシーを再作成
DROP POLICY IF EXISTS "admin_select" ON public.system_settings;
DROP POLICY IF EXISTS "admin_update" ON public.system_settings;
DROP POLICY IF EXISTS "admin_insert" ON public.system_settings;

-- 再度ステップ1のSQL全体を実行
```

### Q: Stripe設定が保存できない

**A: `system_settings` テーブルが作成されているか確認：**

```sql
SELECT * FROM public.system_settings;
```

空の結果 → ステップ1のSQLを再実行

---

## 🔗 詳細ドキュメント

- **ADMIN_SETUP.md** - 管理者権限の詳細手順
- **SETUP_GUIDE.md** - 完全なセットアップガイド
- **README.md** - プロジェクト概要

---

## 📞 サポート

問題が解決しない場合：

1. ブラウザのコンソール（F12）でエラーを確認
2. Supabaseのログを確認
3. `.env.local` の設定を確認

---

**所要時間**: 約5分  
**難易度**: ⭐☆☆☆☆（超簡単）

🚀 **今すぐ始めましょう！**
