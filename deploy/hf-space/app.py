"""RTMPose API Server — Hugging Face Spaces 版。

ローカル版 (api/pose_server.py) との差分:
- MPS/CoreML 依存を削除、CPU 推論のみ
- モデル読込を rtmlib の自動 DL に変更（Dockerfile で事前取得済み）
- PORT 環境変数に従う（HF Spaces のデフォルト 7860）
- CORS は open（Vercel からの cross-origin アクセスを許可）
"""
from __future__ import annotations

import os
import time
import tempfile

import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from rtmlib import Body

app = Flask(__name__)
CORS(app)  # 全 origin 許可（必要に応じて allowed_origins で絞る）

BODY: Body | None = None


def get_body() -> Body:
    global BODY
    if BODY is None:
        BODY = Body(
            mode="performance",       # rtmpose-x + yolox-x 相当、rtmlib が自動 DL
            backend="onnxruntime",
            device="cpu",              # HF Spaces 無料枠は CPU のみ
        )
        print("RTMPose initialized (device=cpu, mode=performance)")
    return BODY


# ── HALPE26 → MediaPipe33 mapping ────────────────────────
HALPE_TO_MP = {
    0: 0,   1: 2,   2: 5,   3: 7,   4: 8,
    5: 11,  6: 12,  7: 13,  8: 14,  9: 15,  10: 16,
    11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28,
    20: 31, 21: 32, 24: 29, 25: 30,
}

INTERPOLATED_MP = {
    1: (0, 1), 3: (1, 1), 4: (0, 2), 6: (2, 2),
    9: (0, 3), 10: (0, 4),
    17: (9, 9), 18: (10, 10), 19: (9, 9), 20: (10, 10),
    21: (9, 9), 22: (10, 10),
}


def halpe_to_mediapipe(kp: np.ndarray, scores: np.ndarray, img_w: int, img_h: int) -> list[dict]:
    MP_TO_HALPE = {m: h for h, m in HALPE_TO_MP.items()}
    mp_landmarks = []
    for mp_idx in range(33):
        if mp_idx in MP_TO_HALPE:
            hi = MP_TO_HALPE[mp_idx]
            mp_landmarks.append({
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
            mp_landmarks.append({"x": float(x), "y": float(y), "z": 0.0, "visibility": v})
        else:
            mp_landmarks.append({"x": 0, "y": 0, "z": 0, "visibility": 0})
    return mp_landmarks


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


@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "service": "running-analysis-pose-server",
        "status": "ok",
        "endpoints": ["/health", "/process_frame", "/process_video"],
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "rtmpose-performance-halpe26"})


@app.route("/process_video", methods=["POST"])
def process_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file"}), 400

    video_file = request.files["video"]
    roi = request.form.get("roi")
    roi_rect = None
    if roi:
        parts = [float(x) for x in roi.split(",")]
        if len(parts) == 4:
            roi_rect = parts

    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    video_file.save(tmp.name)
    tmp.close()

    try:
        cap = cv2.VideoCapture(tmp.name)
        fps = cap.get(cv2.CAP_PROP_FPS)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        body = get_body()

        samples = [total // 3, total // 2, total * 2 // 3]
        best_area = 0
        ref_hip_x = None
        ref_frame = None
        positions = []

        for fi in samples:
            cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
            ret, frame = cap.read()
            if not ret:
                continue
            if roi_rect:
                rx, ry, rw, rh = int(roi_rect[0]*w), int(roi_rect[1]*h), int(roi_rect[2]*w), int(roi_rect[3]*h)
                frame = frame[ry:ry+rh, rx:rx+rw]
            kps, _ = body(frame)
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

        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        all_landmarks = []
        t0 = time.time()

        for fi in range(total):
            ret, frame = cap.read()
            if not ret:
                all_landmarks.append([{"x": 0, "y": 0, "z": 0, "visibility": 0}] * 33)
                continue

            frame_for_pose = frame
            offset_x, offset_y = 0, 0
            if roi_rect:
                rx = int(roi_rect[0] * w)
                ry = int(roi_rect[1] * h)
                rw = int(roi_rect[2] * w)
                rh = int(roi_rect[3] * h)
                frame_for_pose = frame[ry:ry+rh, rx:rx+rw]
                offset_x, offset_y = rx, ry

            kps, sc = body(frame_for_pose)

            predicted = None
            if ref_hip_x is not None and ref_frame is not None:
                predicted = ref_hip_x + velocity * (fi - ref_frame)
                if roi_rect:
                    predicted -= offset_x

            kp, scores = select_runner(kps, sc, predicted)

            if kp is not None:
                kp_full = kp.copy()
                kp_full[:, 0] += offset_x
                kp_full[:, 1] += offset_y
                landmarks = halpe_to_mediapipe(kp_full, scores, w, h)
            else:
                landmarks = [{"x": 0, "y": 0, "z": 0, "visibility": 0}] * 33

            all_landmarks.append(landmarks)

            if fi % 30 == 0:
                print(f"  Frame {fi}/{total} ({time.time()-t0:.0f}s)")

        cap.release()
        elapsed = time.time() - t0

        return jsonify({
            "landmarks": all_landmarks,
            "fps": fps,
            "totalFrames": len(all_landmarks),
            "width": w,
            "height": h,
            "processingTime": round(elapsed, 1),
            "model": "rtmpose-performance-halpe26",
            "direction": "left_to_right" if velocity > 0 else "right_to_left",
        })
    finally:
        os.unlink(tmp.name)


@app.route("/process_frame", methods=["POST"])
def process_frame():
    if "frame" not in request.files:
        return jsonify({"error": "No frame image"}), 400

    frame_file = request.files["frame"]
    img_bytes = np.frombuffer(frame_file.read(), np.uint8)
    frame = cv2.imdecode(img_bytes, cv2.IMREAD_COLOR)

    if frame is None:
        return jsonify({"error": "Invalid image"}), 400

    h, w = frame.shape[:2]
    body = get_body()
    kps, sc = body(frame)
    kp, scores = select_runner(kps, sc)

    if kp is not None:
        landmarks = halpe_to_mediapipe(kp, scores, w, h)
        confidence = float(scores.mean()) if scores is not None else 0
    else:
        landmarks = [{"x": 0, "y": 0, "z": 0, "visibility": 0}] * 33
        confidence = 0

    return jsonify({"landmarks": landmarks, "confidence": confidence})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    print(f"Starting RTMPose API server on port {port}...")
    get_body()  # pre-load
    print("Ready!")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
