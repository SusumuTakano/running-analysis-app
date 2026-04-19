"""RTMPose API Server — drop-in replacement for MediaPipe Pose.

Accepts video frames, runs RTMPose-x, returns MediaPipe-compatible landmarks.
All coordinates are normalized to 0-1 (same as MediaPipe output).
"""
from __future__ import annotations

import json
import os
import sys
import time
import tempfile
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from rtmlib import Body

app = Flask(__name__)
CORS(app)

# ── Model setup ──────────────────────────────────────────
CACHE = os.path.expanduser("~/.cache/rtmlib/hub/checkpoints")

BODY: Body | None = None


def get_body() -> Body:
    global BODY
    if BODY is None:
        # 🚀 Apple Silicon (M1/M2/M3/M4/M5) では device="mps" → CoreMLExecutionProvider が
        #    rtmlib の RTMLIB_SETTINGS['onnxruntime']['mps'] で自動選択される。
        #    Apple Neural Engine / GPU 経由で CPU 比 5-10倍高速化。
        #    環境変数 POSE_DEVICE で明示上書き可能 (例: POSE_DEVICE=cpu)。
        device = os.environ.get("POSE_DEVICE", "mps")
        BODY = Body(
            det=os.path.join(CACHE, "yolox_tiny_8xb8-300e_humanart-6f3252f9.onnx"),  # 高速化: x(396MB) → tiny(20MB)
            det_input_size=(416, 416),
            pose=os.path.join(CACHE, "rtmpose-x_simcc-body7_pt-body7-halpe26_700e-384x288-7fb6e239_20230606.onnx"),
            pose_input_size=(288, 384),
            to_openpose=False,
            mode="performance",
            backend="onnxruntime",
            device=device,
        )
        print(f"RTMPose-x + YOLOX-tiny initialized (device={device})")
    return BODY


# ── HALPE26 → MediaPipe33 mapping ────────────────────────
HALPE_TO_MP = {
    0: 0,   1: 2,   2: 5,   3: 7,   4: 8,
    5: 11,  6: 12,  7: 13,  8: 14,  9: 15,  10: 16,
    11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28,
    20: 31, 21: 32, 24: 29, 25: 30,
}

# Interpolated MP landmarks (from HALPE averages)
# left_eye_inner(1) ≈ avg(nose, left_eye)
# left_eye_outer(3) ≈ left_eye
# right_eye_inner(4) ≈ avg(nose, right_eye)
# right_eye_outer(6) ≈ right_eye
# mouth_left(9) ≈ avg(nose, left_ear) roughly
# mouth_right(10) ≈ avg(nose, right_ear) roughly
INTERPOLATED_MP = {
    1: (0, 1),    # left_eye_inner ≈ avg(nose, left_eye)
    3: (1, 1),    # left_eye_outer ≈ left_eye
    4: (0, 2),    # right_eye_inner ≈ avg(nose, right_eye)
    6: (2, 2),    # right_eye_outer ≈ right_eye
    9: (0, 3),    # mouth_left ≈ avg(nose, left_ear)
    10: (0, 4),   # mouth_right ≈ avg(nose, right_ear)
    17: (9, 9),   # left_pinky ≈ left_wrist
    18: (10, 10), # right_pinky ≈ right_wrist
    19: (9, 9),   # left_index ≈ left_wrist
    20: (10, 10), # right_index ≈ right_wrist
    21: (9, 9),   # left_thumb ≈ left_wrist
    22: (10, 10), # right_thumb ≈ right_wrist
}


def halpe_to_mediapipe(kp: np.ndarray, scores: np.ndarray, img_w: int, img_h: int) -> list[dict]:
    """Convert HALPE26 keypoints to MediaPipe 33-landmark format (normalized 0-1).

    🐛 BUG FIX: 以前は `if mp_idx in HALPE_TO_MP` で検索していたが、
       これは MP インデックスを Halpe キーと誤って比較していた結果、
       左側のランドマーク（MP 11/13/15/23/25/27 など）が 0 になっていた。
       MP_TO_HALPE の逆引き辞書を用いて正しくマッピングする。
    """
    # MP index → Halpe index の逆引き辞書
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
    """Select the largest person (runner) from detections."""
    if len(kps) == 0:
        return None, None

    if predicted_x is not None:
        # Track by hip position
        hip_xs = [(kp[11, 0] + kp[12, 0]) / 2 for kp in kps]
        dists = [abs(hx - predicted_x) for hx in hip_xs]
        idx = int(np.argmin(dists))
        if dists[idx] < 200:
            return kps[idx], scores[idx]

    # Fallback: largest bounding box
    areas = []
    for kp in kps:
        v = kp[kp[:, 0] > 0]
        areas.append((v[:, 0].max() - v[:, 0].min()) * (v[:, 1].max() - v[:, 1].min()) if len(v) > 2 else 0)
    idx = int(np.argmax(areas))
    return kps[idx], scores[idx]


# ── Runner tracking state ────────────────────────────────
runner_state = {
    "hip_x": None,
    "velocity": None,
    "ref_frame": None,
}


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "rtmpose-x-halpe26"})


@app.route("/process_video", methods=["POST"])
def process_video():
    """Process entire video, return all frames as MediaPipe-format landmarks."""
    if "video" not in request.files:
        return jsonify({"error": "No video file"}), 400

    video_file = request.files["video"]
    roi = request.form.get("roi")  # Optional ROI: "x,y,width,height" normalized
    roi_rect = None
    if roi:
        parts = [float(x) for x in roi.split(",")]
        if len(parts) == 4:
            roi_rect = parts  # [x, y, w, h] normalized 0-1

    # Save to temp file
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

        # Pass 1: find runner at mid-video
        samples = [total // 3, total // 2, total * 2 // 3]
        best_area = 0
        ref_hip_x = None
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

        # Compute velocity
        velocity = 0
        if len(positions) >= 2:
            positions.sort()
            velocity = (positions[-1][1] - positions[0][1]) / (positions[-1][0] - positions[0][0])
            ref_frame = positions[len(positions)//2][0]
            ref_hip_x = positions[len(positions)//2][1]

        # Pass 2: process all frames
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        all_landmarks = []
        prev_hip_x = ref_hip_x
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

            # Predict runner position
            predicted = None
            if ref_hip_x is not None and ref_frame is not None:
                predicted = ref_hip_x + velocity * (fi - ref_frame)
                if roi_rect:
                    predicted -= offset_x

            kp, scores = select_runner(kps, sc, predicted)

            if kp is not None:
                # Offset back to full image coords
                kp_full = kp.copy()
                kp_full[:, 0] += offset_x
                kp_full[:, 1] += offset_y
                prev_hip_x = float((kp_full[11, 0] + kp_full[12, 0]) / 2)
                landmarks = halpe_to_mediapipe(kp_full, scores, w, h)
            else:
                landmarks = [{"x": 0, "y": 0, "z": 0, "visibility": 0}] * 33

            all_landmarks.append(landmarks)

            if fi % 30 == 0:
                print(f"  Frame {fi}/{total} ({time.time()-t0:.0f}s)")

        cap.release()
        elapsed = time.time() - t0

        result = {
            "landmarks": all_landmarks,
            "fps": fps,
            "totalFrames": len(all_landmarks),
            "width": w,
            "height": h,
            "processingTime": round(elapsed, 1),
            "model": "rtmpose-x-halpe26",
            "direction": "left_to_right" if velocity > 0 else "right_to_left",
        }

        return jsonify(result)

    finally:
        os.unlink(tmp.name)


@app.route("/process_frame", methods=["POST"])
def process_frame():
    """Process a single frame (for real-time or re-estimation)."""
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
    print("Starting RTMPose API server...")
    print("Loading model (first request will be slow)...")
    get_body()  # Pre-load
    print("Ready!")
    # threaded=True: 複数リクエストを同時処理できるようにする
    # （Flask デフォルトは単一スレッドで、クライアント並列化の効果が出ない）
    app.run(host="0.0.0.0", port=8765, debug=False, threaded=True)
