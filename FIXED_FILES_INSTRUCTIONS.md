# 修正ファイルの適用手順

## 修正が必要な問題
1. ✅ タブ表示が消えている問題 → 修正済み
2. ✅ データが保存されない問題 → 修正済み

## 修正ファイル一覧

### 1. src/pages/UserDashboardPage.tsx
- **問題**: session_dataがnullに設定されていた（355行目）
- **修正**: session_data: nullの行を削除
- **ファイルパス**: `/home/user/webapp/src/pages/UserDashboardPage.tsx`

### 2. src/App.tsx  
- **確認済み**: session_dataとmetadataの保存処理は正しく実装されている（3172-3173行目）
- **ファイルパス**: `/home/user/webapp/src/App.tsx`

## Codespacesでの適用手順

### 方法1: 直接コピー＆ペースト（推奨）

1. **UserDashboardPage.tsxをコピー**
   ```bash
   # Codespacesのターミナルで実行
   cd /workspaces/running-analysis-app
   
   # バックアップを作成
   cp src/pages/UserDashboardPage.tsx src/pages/UserDashboardPage.tsx.backup
   
   # 修正版をダウンロード（以下のファイルを使用）
   ```

2. **ファイルの内容を置き換え**
   - Codespacesで`src/pages/UserDashboardPage.tsx`を開く
   - 全選択（Ctrl+A or Cmd+A）
   - 削除
   - 提供された修正版の内容を貼り付け
   - 保存（Ctrl+S or Cmd+S）

3. **App.tsxを確認（既に正しい）**
   - `src/App.tsx`の3172-3173行目が以下になっていることを確認：
   ```typescript
   payload.session_data = fullAnalysisData;
   payload.metadata = metadataPayload;
   ```

### 方法2: zipファイルで一括適用

1. **修正済みファイルのzipをダウンロード**
   ```bash
   # このzipファイルをCodespacesにアップロード
   /home/user/webapp/fixed_files.zip
   ```

2. **展開して適用**
   ```bash
   cd /workspaces/running-analysis-app
   unzip -o fixed_files.zip
   ```

## Git操作

修正を適用した後：

```bash
# 変更を確認
git status
git diff

# コミット
git add .
git commit -m "fix: タブ表示とsession_data保存の問題を修正

- UserDashboardPage.tsx: session_dataがnullになる問題を修正
- タブのスタイリングを改善
- データ取得処理を最適化"

# プッシュ
git push origin main
```

## 確認方法

1. **ローカルで動作確認**
   ```bash
   npm run build
   npm run preview
   ```

2. **Netlifyにデプロイ**
   - Git pushすると自動デプロイ
   - または手動でNetlify Dropを使用

## 重要な変更点まとめ

### UserDashboardPage.tsx（355行目付近）
**修正前:**
```typescript
session_data: null  // ← これが問題の原因
```

**修正後:**
```typescript
// session_data: null を削除（元のデータを保持）
```

### タブスタイル（1056-1093行目）
- タブの背景色を白に設定
- アクティブタブを青色に
- 非アクティブタブにグレー背景追加
- パディングとマージンの調整

これで、データの保存と表示が正しく動作するはずです！