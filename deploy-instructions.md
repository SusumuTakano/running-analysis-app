# 🚀 デプロイ手順（緊急）

## 現在の状況
- E2Bサンドボックスで28個のコミットを作成
- 最新のビルドも完了（dist/フォルダ）
- GitHub Codespacesには反映されていない

## 即座にデプロイする方法

### Option 1: distフォルダをダウンロード（最速）

1. サンドボックスから `dist` フォルダをダウンロード
2. GitHub Codespacesで:
   ```bash
   cd /workspaces/running-analysis-app
   # 既存のdistを削除
   rm -rf dist
   # 新しいdistをアップロード（または解凍）
   ```
3. Netlifyにデプロイ:
   ```bash
   netlify deploy --prod --dir=dist
   ```

### Option 2: ソースコードをパッチファイルで移行

1. サンドボックスでパッチを作成:
   ```bash
   cd /home/user/webapp
   git format-patch origin/main..HEAD -o patches/
   tar -czf patches.tar.gz patches/
   ```

2. GitHub Codespacesで適用:
   ```bash
   cd /workspaces/running-analysis-app
   git checkout main
   git am patches/*.patch
   npm run build
   netlify deploy --prod --dir=dist
   ```

### Option 3: PR #4を手動でマージ

1. GitHub WebでPR #4を開く
2. 「Merge pull request」をクリック
3. Netlifyが自動デプロイ

## 最新の変更内容

### 実装済み
✅ ステップ9→ステップ8の戻るボタン（大きく見やすく）
✅ ランニング人間アイコン復元
✅ マルチカメラキャリブレーション指示改善

### 既知の問題
⚠️ マルチカメラのストライド誤差（約10cm）
→ シングルカメラのみ推奨として公開

## 推奨デプロイ方法

**今すぐ公開するなら:**
→ Option 1（distフォルダダウンロード）が最速
