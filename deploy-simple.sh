#!/bin/bash

echo "🚀 Starting Netlify deployment..."

# ビルドディレクトリの確認
if [ ! -d "dist" ]; then
    echo "❌ Error: dist directory not found"
    echo "Please run 'npm run build' first"
    exit 1
fi

# Netlify CLIでデプロイ（認証なしで新規サイト作成）
echo "📦 Deploying to Netlify..."

# --prodフラグで本番デプロイ、--openでブラウザを開かない
npx netlify deploy --dir=dist --prod --open=false 2>&1

echo ""
echo "✅ Deployment command executed!"
echo "Note: If this is the first deployment, you may need to authenticate."
