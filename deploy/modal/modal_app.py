"""Modal用 姿勢推定サーバー (RTMPose + GPU)。

デプロイ:
    modal deploy modal_app.py

URLの確認:
    modal app show pose-server

HuggingFace版 (../hf-space/app.py) からの変更点:
- GPU (T4) 推論で大幅高速化 (device=cuda)
- onnxruntime-gpu を使用
- Modal の @asgi_app でFlask風のエンドポイントをFastAPI化
- Scale-to-zero (アイドル時0円、リクエスト時のみ起動)
"""
# ※ `from __future__ import annotations` は使わない (FastAPIのUploadFile型推論と相性悪い)

import io
import os
import tempfile
import time
from typing import Optional

import modal

app = modal.App("pose-server")

# ── モデル URL (halpe26 = 26キーポイント、MediaPipe互換変換あり) ──
DET_URL = "https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/yolox_tiny_8xb8-300e_humanart-6f3252f9.zip"
POSE_URL = "https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-l_simcc-body7_pt-body7-halpe26_700e-256x192-2abb7558_20230605.zip"


# ── コンテナイメージ (事前にモデルをDLしてキャッシュ) ──
def _preload_models():
    """Build 時にモデルをDL → イメージ内にキャッシュ。Cold start 短縮。"""
    from rtmlib import Body
    Body(
        det=DET_URL,
        det_input_size=(416, 416),
        pose=POSE_URL,
        pose_input_size=(192, 256),
        to_openpose=False,
        mode="performance",
        backend="onnxruntime",
        device="cpu",  # build時はCPUでOK (モデルDLだけが目的)
    )


image = (
    # CUDA 12.4 runtime + cuDNN 9 ベースイメージ (onnxruntime-gpu 1.19.x 要件)
    modal.Image.from_registry("nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04", add_python="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0", "ffmpeg", "libsm6", "libxext6")
    .pip_install(
        "fastapi[standard]",
        "python-multipart",
        "opencv-python-headless==4.10.0.84",
        "numpy<2",
        "rtmlib",
        "onnxruntime-gpu==1.19.2",
    )
    .run_function(_preload_models)
)


@app.cls(
    image=image,
    gpu="T4",
    scaledown_window=60,  # 60秒リクエスト無しでコンテナ停止 (課金も停止)
    max_containers=5,     # 同時に最大5コンテナ
    timeout=600,          # 1リクエスト最長10分
)
@modal.concurrent(max_inputs=4)  # 1コンテナで並列4リクエスト処理
class PoseServer:

    @modal.enter()
    def load_model(self):
        """コンテナ起動時にモデルロード (1回だけ)。"""
        import onnxruntime as ort
        providers = ort.get_available_providers()
        print(f"onnxruntime providers available: {providers}")
        if "CUDAExecutionProvider" not in providers:
            raise RuntimeError(
                f"CUDAExecutionProvider not available. Got: {providers}. "
                "Check CUDA/cuDNN installation."
            )

        from rtmlib import Body
        self.body = Body(
            det=DET_URL,
            det_input_size=(416, 416),
            pose=POSE_URL,
            pose_input_size=(192, 256),
            to_openpose=False,
            mode="performance",
            backend="onnxruntime",
            device="cuda",  # T4 GPU
        )
        print("RTMPose initialized on GPU (cuda)")

    @modal.asgi_app()
    def fastapi_app(self):
        from fastapi import FastAPI, UploadFile, File, Form, HTTPException
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.responses import JSONResponse
        import cv2
        import numpy as np

        web = FastAPI()
        web.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # ── HALPE26 → MediaPipe33 mapping ──
        HALPE_TO_MP = {
            0: 0, 1: 2, 2: 5, 3: 7, 4: 8,
            5: 11, 6: 12, 7: 13, 8: 14, 9: 15, 10: 16,
            11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28,
            20: 31, 21: 32, 24: 29, 25: 30,
        }
        INTERPOLATED_MP = {
            1: (0, 1), 3: (1, 1), 4: (0, 2), 6: (2, 2),
            9: (0, 3), 10: (0, 4),
            17: (9, 9), 18: (10, 10), 19: (9, 9), 20: (10, 10),
            21: (9, 9), 22: (10, 10),
        }
        MP_TO_HALPE = {m: h for h, m in HALPE_TO_MP.items()}

        def halpe_to_mediapipe(kp, scores, img_w, img_h):
            out = []
            for mp_idx in range(33):
                if mp_idx in MP_TO_HALPE:
                    hi = MP_TO_HALPE[mp_idx]
                    out.append({
                        "x": float(kp[hi, 0] / img_w),
                        "y": float(kp[hi, 1] / img_h),
                        "z": 0.0,
                        "visibility": float(scores[hi]) if hi < len(scores) else 0.5,
                    })
                elif mp_idx in INTERPOLATED_MP:
                    h1, h2 = INTERPOLATED_MP[mp_idx]
                    x = (kp[h1, 0] + kp[h2, 0]) / 2 / img_w
                    y = (kp[h1, 1] + kp[h2, 1]) / 2 / img_h
                    v = min(float(scores[h1]), float(scores[h2])) if h1 < len(scores) and h2 < len(scores) else 0.3
                    out.append({"x": float(x), "y": float(y), "z": 0.0, "visibility": v})
                else:
                    out.append({"x": 0, "y": 0, "z": 0, "visibility": 0})
            return out

        def select_runner(kps, scores, predicted_x=None):
            if len(kps) == 0:
                return None, None
            if predicted_x is not None:
                hip_xs = [(kp[11, 0] + kp[12, 0]) / 2 for kp in kps]
                dists = [abs(hx - predicted_x) for hx in hip_xs]
                idx = int(np.argmin(dists))
                if dists[idx] < 200:
                    return kps[idx], scores[idx]
            areas = []
            for kp in kps:
                v = kp[kp[:, 0] > 0]
                areas.append((v[:, 0].max() - v[:, 0].min()) * (v[:, 1].max() - v[:, 1].min()) if len(v) > 2 else 0)
            idx = int(np.argmax(areas))
            return kps[idx], scores[idx]

        @web.get("/")
        def root():
            return {
                "service": "running-analysis-pose-server",
                "status": "ok",
                "endpoints": ["/health", "/process_frame", "/process_video"],
                "backend": "modal.com (GPU T4)",
            }

        @web.get("/health")
        def health():
            return {"status": "ok", "model": "rtmpose-performance-halpe26", "backend": "modal+gpu"}

        @web.post("/process_frame")
        async def process_frame(frame: UploadFile = File(...)):
            raw = await frame.read()
            img_bytes = np.frombuffer(raw, np.uint8)
            img = cv2.imdecode(img_bytes, cv2.IMREAD_COLOR)
            if img is None:
                raise HTTPException(400, "Invalid image")
            h, w = img.shape[:2]
            kps, sc = self.body(img)
            kp, scores = select_runner(kps, sc)
            if kp is not None:
                landmarks = halpe_to_mediapipe(kp, scores, w, h)
                confidence = float(scores.mean()) if scores is not None else 0
            else:
                landmarks = [{"x": 0, "y": 0, "z": 0, "visibility": 0}] * 33
                confidence = 0
            return {"landmarks": landmarks, "confidence": confidence}

        @web.post("/process_video")
        async def process_video(
            video: UploadFile = File(...),
            roi: Optional[str] = Form(None),
            start_frac: Optional[str] = Form(None),
            end_frac: Optional[str] = Form(None),
        ):
            roi_rect = None
            if roi:
                parts = [float(x) for x in roi.split(",")]
                if len(parts) == 4:
                    roi_rect = parts

            # 解析範囲（割合 0〜1）。未指定なら全区間（＝従来動作）。
            try:
                sf_frac = float(start_frac) if start_frac is not None else 0.0
            except (TypeError, ValueError):
                sf_frac = 0.0
            try:
                ef_frac = float(end_frac) if end_frac is not None else 1.0
            except (TypeError, ValueError):
                ef_frac = 1.0
            sf_frac = min(max(sf_frac, 0.0), 1.0)
            ef_frac = min(max(ef_frac, 0.0), 1.0)
            if ef_frac < sf_frac:
                sf_frac, ef_frac = 0.0, 1.0

            tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
            data = await video.read()
            tmp.write(data)
            tmp.close()

            try:
                cap = cv2.VideoCapture(tmp.name)
                fps = cap.get(cv2.CAP_PROP_FPS)
                total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

                samples = [total // 3, total // 2, total * 2 // 3]
                best_area = 0
                ref_hip_x = None
                ref_frame = None
                positions = []

                for fi in samples:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
                    ret, frame_img = cap.read()
                    if not ret:
                        continue
                    if roi_rect:
                        rx, ry, rw, rh = int(roi_rect[0]*w), int(roi_rect[1]*h), int(roi_rect[2]*w), int(roi_rect[3]*h)
                        frame_img = frame_img[ry:ry+rh, rx:rx+rw]
                    kps, _ = self.body(frame_img)
                    for kp in kps:
                        v = kp[kp[:, 0] > 0]
                        if len(v) < 3:
                            continue
                        area = (v[:, 0].max() - v[:, 0].min()) * (v[:, 1].max() - v[:, 1].min())
                        if area > best_area:
                            best_area = area
                            hip_x = float((kp[11, 0] + kp[12, 0]) / 2)
                            if roi_rect:
                                hip_x += roi_rect[0] * w
                            positions.append((fi, hip_x))

                velocity = 0
                if len(positions) >= 2:
                    positions.sort()
                    velocity = (positions[-1][1] - positions[0][1]) / (positions[-1][0] - positions[0][0])
                    ref_frame = positions[len(positions) // 2][0]
                    ref_hip_x = positions[len(positions) // 2][1]

                # 処理する範囲（フレーム番号）。範囲外は推論せず空ランドマークで埋め、
                # 返却配列は常に全フレーム長を維持（フロントのフレーム対応をそのまま使える）。
                sf = min(max(int(round(sf_frac * total)), 0), total)
                ef = min(max(int(round(ef_frac * total)), sf), total)

                def _empty_lm():
                    return [{"x": 0, "y": 0, "z": 0, "visibility": 0} for _ in range(33)]

                all_landmarks = []
                t0 = time.time()

                # 範囲手前は推論スキップ
                for _ in range(sf):
                    all_landmarks.append(_empty_lm())

                cap.set(cv2.CAP_PROP_POS_FRAMES, sf)
                for fi in range(sf, ef):
                    ret, frame_img = cap.read()
                    if not ret:
                        all_landmarks.append([{"x": 0, "y": 0, "z": 0, "visibility": 0}] * 33)
                        continue

                    frame_for_pose = frame_img
                    offset_x, offset_y = 0, 0
                    if roi_rect:
                        rx = int(roi_rect[0] * w)
                        ry = int(roi_rect[1] * h)
                        rw = int(roi_rect[2] * w)
                        rh = int(roi_rect[3] * h)
                        frame_for_pose = frame_img[ry:ry+rh, rx:rx+rw]
                        offset_x, offset_y = rx, ry

                    kps, sc = self.body(frame_for_pose)

                    # 速度予測は off (走者選択の一貫性確保のため毎フレーム最大人物を選ぶ)
                    kp, scores = select_runner(kps, sc, None)

                    if kp is not None:
                        kp_full = kp.copy()
                        kp_full[:, 0] += offset_x
                        kp_full[:, 1] += offset_y
                        landmarks = halpe_to_mediapipe(kp_full, scores, w, h)
                    else:
                        landmarks = [{"x": 0, "y": 0, "z": 0, "visibility": 0}] * 33

                    all_landmarks.append(landmarks)

                    if fi % 60 == 0:
                        print(f"  Frame {fi}/{ef} (range {sf}-{ef}/{total}) ({time.time()-t0:.1f}s)")

                # 範囲より後ろは推論スキップ（空で埋めて全長を維持）
                for _ in range(ef, total):
                    all_landmarks.append(_empty_lm())

                cap.release()
                elapsed = time.time() - t0

                return JSONResponse({
                    "landmarks": all_landmarks,
                    "fps": fps,
                    "totalFrames": len(all_landmarks),
                    "width": w,
                    "height": h,
                    "processingTime": round(elapsed, 1),
                    "model": "rtmpose-performance-halpe26",
                    "backend": "modal+gpu(T4)",
                    "direction": "left_to_right" if velocity > 0 else "right_to_left",
                })
            finally:
                os.unlink(tmp.name)

        return web
