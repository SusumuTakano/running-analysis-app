#!/bin/bash

# .env.deployファイルから環境変数を読み込んでデプロイ

if [ -f .env.deploy ]; then
    export $(cat .env.deploy | grep -v '^#' | xargs)
    echo "✅ Loaded environment variables from .env.deploy"
else
    echo "⚠️  .env.deploy file not found"
    echo "Please create .env.deploy with:"
    echo "  NETLIFY_AUTH_TOKEN=your-token"
    echo "  NETLIFY_SITE_ID=your-site-id (optional)"
    exit 1
fi

# デプロイスクリプトを実行
./deploy-netlify.sh