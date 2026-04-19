---
title: Running Analysis Pose Server
emoji: 🏃
colorFrom: blue
colorTo: cyan
sdk: docker
app_port: 7860
pinned: false
---

# Running Analysis Pose Server (RTMPose)

スプリント動作解析アプリ [running-analysis-app](https://github.com/) のバックエンド。
動画フレームを受け取り、RTMPose で姿勢推定した結果（MediaPipe 互換 33 ランドマーク）を返します。

## エンドポイント

| Method | Path | 説明 |
|---|---|---|
| GET | `/` | サービス情報 |
| GET | `/health` | ヘルスチェック |
| POST | `/process_frame` | 単一フレーム (JPEG) → landmarks |
| POST | `/process_video` | 動画全体 → 全フレーム landmarks |

## フロントエンドとの接続

Vercel にデプロイしたフロントエンドの環境変数に以下を設定:

```
VITE_RTMPOSE_API=https://<your-username>-<space-name>.hf.space
```

## 無料枠の制約

- CPU 2 vCPU / 16GB RAM
- GPU なし（RTMPose-x on CPU = ~300-500ms/frame）
- 48時間非活動でスリープ（次アクセスで cold start 30-60s）

重い動画を処理する場合は Pro Space ($9/月) で T4 GPU にアップグレード可能。

## ローカル動作確認

```bash
cd deploy/hf-space
docker build -t pose-server .
docker run -p 7860:7860 pose-server
curl http://localhost:7860/health
```
