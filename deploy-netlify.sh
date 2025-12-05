#!/bin/bash

# Netlifyデプロイスクリプト
# GitHub Codespaces用

echo "🚀 Starting Netlify deployment..."

# 環境変数チェック
if [ -z "$NETLIFY_AUTH_TOKEN" ]; then
    echo "❌ Error: NETLIFY_AUTH_TOKEN is not set"
    echo "Please set it using: export NETLIFY_AUTH_TOKEN='your-token'"
    exit 1
fi

# ビルド
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# デプロイ
echo "🌍 Deploying to Netlify..."

if [ -z "$NETLIFY_SITE_ID" ]; then
    echo "📝 Creating new Netlify site..."
    netlify deploy --prod --dir=dist --auth $NETLIFY_AUTH_TOKEN
    echo ""
    echo "⚠️  Please save the Site ID above and run:"
    echo "export NETLIFY_SITE_ID='your-site-id'"
else
    echo "📝 Deploying to existing site: $NETLIFY_SITE_ID"
    netlify deploy --prod --dir=dist --auth $NETLIFY_AUTH_TOKEN --site $NETLIFY_SITE_ID
fi

echo "✅ Deployment complete!"