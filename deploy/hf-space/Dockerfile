FROM python:3.11-slim

# ONNX Runtime に必要な native ライブラリ（opencv-python-headless なので libGL 不要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces は /app を使う想定（権限問題回避）
WORKDIR /app

# Python 依存関係
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリ本体
COPY app.py .

# モデル事前ダウンロード（halpe26 形式 = 26 キーポイント、ローカル版と互換）
# rtmlib が .zip URL を受け取り自動 DL & 解凍する。初回 Body() 呼び出しを Docker ビルド時に実行。
RUN python -c "\
from rtmlib import Body; \
Body( \
    det='https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/yolox_tiny_8xb8-300e_humanart-6f3252f9.zip', \
    det_input_size=(416, 416), \
    pose='https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-l_simcc-body7_pt-body7-halpe26_700e-256x192-2abb7558_20230605.zip', \
    pose_input_size=(192, 256), \
    mode='performance', \
    backend='onnxruntime', \
    device='cpu' \
)"

# HF Spaces のデフォルトポートは 7860
ENV PORT=7860
EXPOSE 7860

CMD ["python", "app.py"]
