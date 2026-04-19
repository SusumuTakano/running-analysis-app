FROM python:3.11-slim

# ONNX Runtime に必要な native ライブラリ（opencv-python-headless なので libGL 不要）
# wget はモデル事前ダウンロード用
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces は /app を使う想定（権限問題回避）
WORKDIR /app

# Python 依存関係
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# モデル事前ダウンロード（halpe26 形式 = 26 キーポイント、ローカル版と互換）
# yolox-tiny (20MB) + rtmpose-m (~15MB、256x192) で CPU 上での処理速度優先
RUN mkdir -p /root/.cache/rtmlib/hub/checkpoints && \
    wget -q -O /root/.cache/rtmlib/hub/checkpoints/yolox_tiny_8xb8-300e_humanart-6f3252f9.onnx \
        https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/yolox_tiny_8xb8-300e_humanart-6f3252f9.onnx && \
    wget -q -O /root/.cache/rtmlib/hub/checkpoints/rtmpose-m_simcc-body7_pt-body7-halpe26_700e-256x192-4d3e73dd_20230605.onnx \
        https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-m_simcc-body7_pt-body7-halpe26_700e-256x192-4d3e73dd_20230605.onnx

# アプリ本体
COPY app.py .

# HF Spaces のデフォルトポートは 7860
ENV PORT=7860
EXPOSE 7860

CMD ["python", "app.py"]
