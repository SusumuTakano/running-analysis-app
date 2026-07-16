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
# yolox_tiny(416固定) → yolox_m(640): 1080p映像で遠い/ブラーの強い走者の検出率を上げる
DET_URL = "https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/yolox_m_8xb8-300e_humanart-c2c7a14a.zip"
POSE_URL = "https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-l_simcc-body7_pt-body7-halpe26_700e-256x192-2abb7558_20230605.zip"


# ── コンテナイメージ (事前にモデルをDLしてキャッシュ) ──
def _preload_models():
    """Build 時にモデルをDL → イメージ内にキャッシュ。Cold start 短縮。"""
    from rtmlib import Body
    Body(
        det=DET_URL,
        det_input_size=(640, 640),
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
            # 416→640: 1080p映像で遠い/ブラーの強い走者の検出率を上げる
            # （T4では1フレームあたり数msの増加で済む）
            det_input_size=(640, 640),
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
            mode: Optional[str] = Form(None),
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

                # 📱 iPhone等の動画は「回転メタデータ」を持つ。ブラウザ（特にiPhone Safari）は
                # これを適用して表示するが、サーバーのデコードは無視するため骨格座標がズレる。
                # → メタデータを読み、各フレームをサーバー側でも手動回転して向きを揃える。
                # （メタデータが無いPC転送動画は rotate_code=0 で無変更＝従来通り）
                try:
                    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 0)  # 二重回転を防ぐため自動回転OFF
                except Exception:
                    pass
                try:
                    rotate_code = int(round(cap.get(cv2.CAP_PROP_ORIENTATION_META))) % 360
                except Exception:
                    rotate_code = 0
                print(f"🔄 rotation metadata = {rotate_code}deg (raw {w}x{h})")

                def _apply_rotation(img):
                    if rotate_code == 90:
                        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
                    if rotate_code == 180:
                        return cv2.rotate(img, cv2.ROTATE_180)
                    if rotate_code == 270:
                        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
                    return img

                # 90/270回転では縦横が入れ替わる → 正規化用の w,h も入れ替える
                if rotate_code in (90, 270):
                    w, h = h, w

                # 処理する範囲（フレーム番号）。範囲外は推論せず空ランドマークで埋め、
                # 返却配列は常に全フレーム長を維持（フロントのフレーム対応をそのまま使える）。
                sf = min(max(int(round(sf_frac * total)), 0), total)
                ef = min(max(int(round(ef_frac * total)), sf), total)

                # 🛡️ 安全マージン: クライアント指定の範囲に前後2秒ぶんを必ず追加する。
                #    範囲指定が狭すぎる/古いクライアントでも、スタートの構えや
                #    フィニッシュ後の減速局面の姿勢が欠けないようにする（コスト増は僅か）。
                if sf > 0 or ef < total:
                    margin_f = int(round((fps if fps and fps > 1 else 60) * 2.0))
                    sf = max(0, sf - margin_f)
                    ef = min(total, ef + margin_f)

                def _empty_lm():
                    return [{"x": 0, "y": 0, "z": 0, "visibility": 0} for _ in range(33)]

                t0 = time.time()

                # 🏃 走者追跡方式:
                #   従来は毎フレーム「最大の人物」を選んでいたが、見学者や寝ている人が
                #   カメラに近い（＝大きく写る）と走者以外を拾ってしまう。
                #   → 全フレームの候補者を集め、近傍マッチングでトラック（人物の軌跡）を作り、
                #     「最も大きく水平移動したトラック」＝走者として採用する。
                #     静止している見学者はトラックの移動量がほぼ0なので確実に除外される。

                # 1) 各フレームの人物候補を収集
                #    パン撮影時は同じループで「黄色ポール」候補も検出（距離校正用）
                frame_cands = []  # index: fi - sf
                pole_cands = []   # index: fi - sf → [pole_screen_x(フル解像度px), ...]
                PW, PH = 480, 270  # ポール検出の縮小解像度
                cap.set(cv2.CAP_PROP_POS_FRAMES, sf)
                for fi in range(sf, ef):
                    ret, frame_img = cap.read()
                    if not ret:
                        frame_cands.append([])
                        pole_cands.append([])
                        continue

                    frame_img = _apply_rotation(frame_img)  # 📱 回転メタデータを適用

                    if mode == "panning":
                        # 🟡 黄色ポール検出: 細く縦に連続した黄色柱（日向の芝はG優勢なので R>=G で除外）
                        small = cv2.resize(frame_img, (PW, PH), interpolation=cv2.INTER_AREA)
                        bs = small[..., 0].astype(np.int16)  # OpenCVはBGR順
                        gs = small[..., 1].astype(np.int16)
                        rs = small[..., 2].astype(np.int16)
                        yellow = (rs - bs > 60) & (rs > 160) & (rs >= gs) & (gs - bs > 30)
                        band = yellow[int(PH * 0.25):int(PH * 0.95), :]
                        bh = band.shape[0]
                        runs = np.zeros(PW, dtype=np.int32)
                        cur = np.zeros(PW, dtype=np.int32)
                        for row in band:
                            cur = (cur + 1) * row
                            runs = np.maximum(runs, cur)
                        cols = np.where(runs >= int(bh * 0.20))[0]
                        clusters = []
                        if len(cols):
                            s0 = cols[0]; pg = cols[0]
                            for c in cols[1:]:
                                if c - pg > 3:
                                    clusters.append((s0, pg)); s0 = c
                                pg = c
                            clusters.append((s0, pg))
                        pole_cands.append([
                            (a + b) / 2 * w / PW for (a, b) in clusters if (b - a + 1) <= 10
                        ])
                    else:
                        pole_cands.append([])
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
                    cands = []
                    for kp, s in zip(kps, sc):
                        v = kp[kp[:, 0] > 0]
                        if len(v) < 3:
                            continue
                        area = float((v[:, 0].max() - v[:, 0].min()) * (v[:, 1].max() - v[:, 1].min()))
                        kp_full = kp.copy()
                        kp_full[:, 0] += offset_x
                        kp_full[:, 1] += offset_y
                        hx = float((kp_full[11, 0] + kp_full[12, 0]) / 2)
                        hy = float((kp_full[11, 1] + kp_full[12, 1]) / 2)
                        cands.append({"kp": kp_full, "sc": s, "area": area, "hx": hx, "hy": hy})
                    frame_cands.append(cands)

                    if fi % 60 == 0:
                        print(f"  Frame {fi}/{ef} (range {sf}-{ef}/{total}) ({time.time()-t0:.1f}s)")

                # 2) 近傍マッチングでトラック構築（等速予測つき）
                #    予測位置 = 前回位置 + 速度×経過フレーム。
                #    これにより走者が静止した見学者とすれ違っても、トラックは走者の
                #    進行方向を追い続け、静止人物に乗り移らない。
                GATE = max(w, h) * 0.03   # 1フレームあたりの許容移動量（例: 1920pxで約58px）
                MAX_SKIP = 30             # 検出抜けを許容するフレーム数
                tracks = []
                for idx, cands in enumerate(frame_cands):
                    assigned = set()
                    for tr in tracks:
                        gap = idx - tr["last_idx"]
                        if gap <= 0 or gap > MAX_SKIP:
                            continue
                        pred_x = tr["last_hx"] + tr["vx"] * gap
                        pred_y = tr["last_hy"]
                        best_j, best_d = None, None
                        for j, c in enumerate(cands):
                            if j in assigned:
                                continue
                            d = ((c["hx"] - pred_x) ** 2 + (c["hy"] - pred_y) ** 2) ** 0.5
                            if best_d is None or d < best_d:
                                best_j, best_d = j, d
                        if best_j is not None and best_d <= GATE * min(gap, 5):
                            c = cands[best_j]
                            assigned.add(best_j)
                            new_vx = (c["hx"] - tr["last_hx"]) / gap
                            tr["vx"] = new_vx if tr["n"] < 2 else (0.6 * tr["vx"] + 0.4 * new_vx)
                            tr["n"] += 1
                            tr["items"][idx] = c
                            tr["last_idx"] = idx
                            tr["last_hx"] = c["hx"]
                            tr["last_hy"] = c["hy"]
                            tr["min_hx"] = min(tr["min_hx"], c["hx"])
                            tr["max_hx"] = max(tr["max_hx"], c["hx"])
                    for j, c in enumerate(cands):
                        if j not in assigned:
                            tracks.append({
                                "items": {idx: c},
                                "last_idx": idx,
                                "last_hx": c["hx"], "last_hy": c["hy"],
                                "min_hx": c["hx"], "max_hx": c["hx"],
                                "vx": 0.0, "n": 1,
                            })

                # 3a) 各トラックの「静止区間」を刈り取る
                #     すれ違いで静止人物に乗り移った尻尾や、静止見学者そのものを除去する。
                #     （10フレームで幅1.2%未満しか動かない区間を静止とみなす。
                #       検出ジッターは±10px程度あるため0.5%では静止人物を刈り取れない。
                #       走者は最徐行でも10フレームで60px以上動くので誤刈りしない）
                STILL_EPS = w * 0.012
                STILL_WIN = 10

                def _trim_static(items):
                    idxs = sorted(items.keys())
                    if len(idxs) < STILL_WIN:
                        return items
                    xs = {i: items[i]["hx"] for i in idxs}
                    # 末尾から: 直近STILL_WINフレームの移動が小さい間は削る
                    while len(idxs) >= STILL_WIN:
                        tail = idxs[-STILL_WIN:]
                        if max(xs[i] for i in tail) - min(xs[i] for i in tail) < STILL_EPS:
                            idxs.pop()
                        else:
                            break
                    # 先頭から同様
                    while len(idxs) >= STILL_WIN:
                        head = idxs[:STILL_WIN]
                        if max(xs[i] for i in head) - min(xs[i] for i in head) < STILL_EPS:
                            idxs.pop(0)
                        else:
                            break
                    return {i: items[i] for i in idxs}

                moving_tracks = []
                for tr in tracks:
                    items = _trim_static(tr["items"])
                    if len(items) < 5:
                        continue
                    idxs = sorted(items.keys())
                    xs = [items[i]["hx"] for i in idxs]
                    span = max(xs) - min(xs)
                    if span < w * 0.03:
                        continue  # ほぼ動いていない → 走者ではない
                    vx = (xs[-1] - xs[0]) / max(1, idxs[-1] - idxs[0])
                    moving_tracks.append({
                        "items": items, "start": idxs[0], "end": idxs[-1],
                        "start_hx": xs[0], "end_hx": xs[-1], "vx": vx, "span": span,
                    })

                # 3b) 途切れた走者トラックを速度整合で縫合（すれ違いで分断された前後をつなぐ）
                moving_tracks.sort(key=lambda t: t["start"])
                stitched = []
                for tr in moving_tracks:
                    merged = False
                    for st in stitched:
                        gap = tr["start"] - st["end"]
                        # すれ違い分断では数フレーム重なることがあるため、小さな重なりも許容
                        if gap < -10 or gap > MAX_SKIP * 2:
                            continue
                        pred = st["end_hx"] + st["vx"] * gap
                        same_dir = (st["vx"] * tr["vx"] > 0) or abs(tr["vx"]) < 1.0
                        if same_dir and abs(tr["start_hx"] - pred) <= GATE * min(max(gap, 1), 8):
                            st["items"].update(tr["items"])
                            st["end"] = tr["end"]
                            st["end_hx"] = tr["end_hx"]
                            idxs = sorted(st["items"].keys())
                            xs = [st["items"][i]["hx"] for i in idxs]
                            st["span"] = max(xs) - min(xs)
                            st["vx"] = (xs[-1] - xs[0]) / max(1, idxs[-1] - idxs[0])
                            merged = True
                            break
                    if not merged:
                        stitched.append(tr)

                # 3c) 縫合後にもう一度静止区間を刈り、「最も水平移動した」トラック＝走者
                runner = None
                best_span = 0.0
                for tr in stitched:
                    tr["items"] = _trim_static(tr["items"])
                    if len(tr["items"]) < 5:
                        continue
                    xs = [c["hx"] for c in tr["items"].values()]
                    tr["span"] = max(xs) - min(xs)
                    if tr["span"] > best_span:
                        best_span, runner = tr["span"], tr

                use_tracking = runner is not None and best_span > w * 0.15

                # 🎥 パン撮影では走者追跡を使わない:
                #    カメラが走者を追うため走者は画面内でほぼ静止し、逆に背景の人物が
                #    画面を大きく横切る（見かけの移動量が最大になる）。
                #    水平移動量による走者選択が成立しないので、従来の「毎フレーム最大人物」
                #    方式（パン撮影で実績あり）を使う。
                if mode == "panning":
                    use_tracking = False
                    print("🎥 panning mode: 走者追跡をスキップし従来方式（最大人物）を使用")

                # 3d) 走者トラックの欠測フレームを他トラックの整合候補で補完
                #     （すれ違い時に別トラックへ流れた走者の検出を回収する）
                if use_tracking:
                    import bisect
                    r_idxs = sorted(runner["items"].keys())
                    r_xs = [runner["items"][i]["hx"] for i in r_idxs]

                    def _interp_hx(i):
                        p = bisect.bisect_left(r_idxs, i)
                        if p <= 0 or p >= len(r_idxs):
                            return None
                        i0, i1 = r_idxs[p - 1], r_idxs[p]
                        x0, x1 = r_xs[p - 1], r_xs[p]
                        return x0 + (x1 - x0) * (i - i0) / max(1, i1 - i0)

                    filled = 0
                    for tr in stitched:
                        if tr is runner:
                            continue
                        for i, c in tr["items"].items():
                            if i in runner["items"]:
                                continue
                            exp = _interp_hx(i)
                            if exp is not None and abs(c["hx"] - exp) <= GATE * 2:
                                runner["items"][i] = c
                                filled += 1
                    if filled:
                        print(f"🧩 欠測補完: 他トラックから{filled}フレーム回収")

                if use_tracking:
                    print(f"🏃 走者トラック採用: {len(runner['items'])}フレーム, 水平移動 {best_span:.0f}px / {w}px, トラック数={len(tracks)}")
                else:
                    print(f"⚠️ 移動トラックなし → 従来の最大人物方式にフォールバック (トラック数={len(tracks)}, best_span={best_span:.0f}px)")

                # 4) ランドマーク列を構築（範囲外・欠測は空で埋める）
                all_landmarks = [_empty_lm() for _ in range(sf)]
                for idx in range(len(frame_cands)):
                    if use_tracking:
                        c = runner["items"].get(idx)
                    else:
                        cands = frame_cands[idx]
                        c = max(cands, key=lambda x: x["area"]) if cands else None
                    if c is not None:
                        all_landmarks.append(halpe_to_mediapipe(c["kp"], c["sc"], w, h))
                    else:
                        all_landmarks.append(_empty_lm())
                for _ in range(ef, total):
                    all_landmarks.append(_empty_lm())

                # 走行方向は走者トラックの始点→終点から判定
                velocity = 0.0
                if use_tracking and len(runner["items"]) >= 2:
                    idxs = sorted(runner["items"].keys())
                    velocity = (runner["items"][idxs[-1]]["hx"] - runner["items"][idxs[0]]["hx"]) / max(1, idxs[-1] - idxs[0])

                cap.release()
                elapsed = time.time() - t0

                debug_tracks = [
                    {"start": t["start"], "end": t["end"],
                     "startHx": round(t["start_hx"]), "endHx": round(t["end_hx"]),
                     "vx": round(t["vx"], 2), "frames": len(t["items"]), "span": round(t["span"])}
                    for t in stitched
                ]

                # 🟡 ポールトラック構築（パン距離校正用）:
                #    候補を近傍マッチングで追跡し、「画面を大きく横切る細い縦柱」だけをポールとする。
                #    走者の黄色い靴等は画面中央に留まるため横断条件で除外される。
                pole_tracks_out = []
                if mode == "panning" and any(pole_cands):
                    P_GATE = w * 0.025  # 1フレームあたり許容移動
                    ptracks = []
                    for idx, cands_ in enumerate(pole_cands):
                        used_ = set()
                        for tr in ptracks:
                            gap = idx - tr["li"]
                            if gap <= 0 or gap > 12:
                                continue
                            pred = tr["lx"] + tr["vx"] * gap
                            bj, bd = None, None
                            for j, x in enumerate(cands_):
                                if j in used_:
                                    continue
                                d_ = abs(x - pred)
                                if bd is None or d_ < bd:
                                    bj, bd = j, d_
                            if bj is not None and bd <= P_GATE * gap:
                                x = cands_[bj]; used_.add(bj)
                                nv = (x - tr["lx"]) / gap
                                tr["vx"] = nv if tr["n"] < 2 else 0.5 * tr["vx"] + 0.5 * nv
                                tr["n"] += 1
                                tr["pts"][idx] = x
                                tr["li"], tr["lx"] = idx, x
                        for j, x in enumerate(cands_):
                            if j not in used_:
                                ptracks.append({"pts": {idx: x}, "li": idx, "lx": x, "vx": 0.0, "n": 1})
                    min_life = max(20, int(round((fps if fps and fps > 1 else 60) * 0.2)))
                    for tr in ptracks:
                        if len(tr["pts"]) < min_life:
                            continue
                        xs_ = list(tr["pts"].values())
                        if max(xs_) - min(xs_) < w * 0.3:
                            continue
                        idxs_ = sorted(tr["pts"].keys())
                        pole_tracks_out.append({
                            "frames": [i + sf for i in idxs_],
                            "xs": [round(tr["pts"][i], 1) for i in idxs_],
                        })
                    pole_tracks_out.sort(key=lambda p: p["frames"][0])
                    print(f"🟡 ポールトラック: {len(pole_tracks_out)}本検出")

                return JSONResponse({
                    "landmarks": all_landmarks,
                    "debugTracks": debug_tracks,
                    "poleTracks": pole_tracks_out,
                    "fps": fps,
                    "totalFrames": len(all_landmarks),
                    "width": w,
                    "height": h,
                    "rotation": rotate_code,
                    "processingTime": round(elapsed, 1),
                    "model": "rtmpose-performance-halpe26",
                    "backend": "modal+gpu(T4)",
                    "direction": "left_to_right" if velocity > 0 else "right_to_left",
                })
            finally:
                os.unlink(tmp.name)

        return web
