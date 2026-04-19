# Vercel + Hugging Face Spaces デプロイ手順

フロントエンドを **Vercel**、姿勢推定バックエンドを **Hugging Face Spaces** にデプロイする手順。

```
┌─────────────────────┐        ┌──────────────────────────┐
│  Vercel (frontend)  │──────▶│  HF Spaces (Docker)       │
│  React + Vite       │        │  Flask + RTMPose          │
│  静的ファイルのみ    │        │  /process_frame など       │
└─────────────────────┘        └──────────────────────────┘
       ↑                                   ↑
  VITE_RTMPOSE_API_URL 環境変数で接続
```

---

## 事前準備（アカウント取得）

1. **GitHub**: https://github.com/join （無料）
2. **Vercel**: https://vercel.com/signup （GitHub 連携、無料）
3. **Hugging Face**: https://huggingface.co/join （無料）

---

## Part 1: Hugging Face Spaces にバックエンドを置く

### 1-1. Space を作る

1. https://huggingface.co/new-space を開く
2. 項目を埋める:
   - **Owner**: 自分のアカウント
   - **Space name**: `pose-server` など任意
   - **License**: 任意（MIT 推奨）
   - **Space SDK**: **Docker** を選択 ⚠️
   - **Template**: Blank
   - **Public/Private**: Public（無料枠用）
   - **Hardware**: **CPU basic (free)** を選択
3. `Create Space` をクリック

### 1-2. `deploy/hf-space/` の中身を Space にプッシュ

作成された Space の画面上部にある Git URL（例 `https://huggingface.co/spaces/USERNAME/pose-server`）を使います。

```bash
# 1. Space を別フォルダに clone
cd ~
git clone https://huggingface.co/spaces/USERNAME/pose-server
cd pose-server

# 2. 本リポジトリ内の deploy/hf-space/ をコピー
cp /Users/takanosusumu/running-analysis-app/deploy/hf-space/* .

# 3. プッシュ
git add .
git commit -m "Initial pose server deploy"
git push
```

push 後、HF Space 画面で **Building** になる → **Running** になれば起動完了（初回は model DL を含めて 5-10 分かかる）。

### 1-3. 動作確認

Space の URL は `https://USERNAME-pose-server.hf.space` の形式。

```bash
curl https://USERNAME-pose-server.hf.space/health
# {"status":"ok","model":"rtmpose-performance-halpe26"}
```

この URL を後で Vercel の環境変数に入れます。

---

## Part 2: Vercel にフロントをデプロイ

### 2-1. リポジトリを GitHub に push

```bash
cd /Users/takanosusumu/running-analysis-app

# 初回のみ
gh repo create running-analysis-app --public --source=. --remote=origin --push
# 既存なら
git add .
git commit -m "Prepare for Vercel deploy"
git push
```

### 2-2. Vercel にインポート

1. https://vercel.com/new にアクセス
2. `running-analysis-app` を選択 → `Import`
3. **Framework Preset**: `Vite` が自動検出される
4. **Root Directory**: そのまま（リポジトリ直下）
5. **Environment Variables** セクションに以下を追加:

    | Key | Value |
    |---|---|
    | `VITE_SUPABASE_URL` | `.env` の値 |
    | `VITE_SUPABASE_ANON_KEY` | `.env` の値 |
    | `VITE_RTMPOSE_API_URL` | `https://USERNAME-pose-server.hf.space` |
    | `VITE_OPENAI_API_KEY` | （AIアドバイス使うなら） |
    | `VITE_OPENAI_BASE_URL` | （同上） |

6. `Deploy` をクリック

3-5 分でビルド完了 → 公開 URL が発行される（例: `running-analysis-app.vercel.app`）。

---

## Part 3: 動作確認

1. Vercel の URL を開く
2. 動画をアップロード → 姿勢推定
3. ブラウザのコンソール（F12）で以下が出れば成功:

    ```
    ✅ RTMPose APIサーバー接続成功 — MediaPipeをスキップ
    ```

---

## トラブルシュート

### HF Space が起動しない（Build Failed）
- Space の "Logs" タブを確認
- よくある原因: モデル DL のタイムアウト → Dockerfile の RUN 行を削除して try 再 build（cold start 時に DL される）

### `/rtmpose/health` が CORS エラー
- `app.py` の `CORS(app)` が効いているか確認
- Vercel ドメインが Space からアクセスできるか確認

### 姿勢推定が遅い（5 分以上）
- HF Space 無料枠は CPU のみ。RTMPose-x on CPU は ~300-500ms/frame
- 300 フレームで 1-2 分が目安
- 5 分以上なら、Space が sleep から起きていない可能性（最初のリクエストで cold start 30-60 秒）
- GPU が必要なら HF Spaces Pro ($9/月, T4 GPU) にアップグレード

### Space が 48時間で sleep した
- 無料枠の仕様。次のリクエストで自動起動（30-60秒）
- 常時稼働させたい場合は Pro 契約 or cron で定期 ping

---

## ローカル開発は今まで通り

この変更はローカル環境に影響しません:

```bash
# ターミナル 1: バックエンド
cd /Users/takanosusumu/running-analysis-app
python api/pose_server.py  # localhost:8765

# ターミナル 2: フロント
npm run dev  # localhost:5173, proxy で /rtmpose → localhost:8765
```

`VITE_RTMPOSE_API_URL` が未設定なら `/rtmpose` にフォールバックするので、ローカル動作は変わりません。
