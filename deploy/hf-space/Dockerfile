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

# モデルキャッシュを事前ダウンロード（起動時の cold start 短縮）
# rtmlib は初回 Body() 呼び出し時に ~/.cache に自動 DL される
RUN python -c "from rtmlib import Body; Body(mode='performance', backend='onnxruntime', device='cpu')"

# HF Spaces のデフォルトポートは 7860
ENV PORT=7860
EXPOSE 7860

CMD ["python", "app.py"]
