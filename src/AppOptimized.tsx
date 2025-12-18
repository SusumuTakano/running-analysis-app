import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import "./App.css";
import { supabase } from "./lib/supabaseClient";
import Chart from "chart.js/auto";
import { generateRunningEvaluation, type RunningEvaluation } from "./runningEvaluation";
import {
  analyzeSimpleToeTrajectory,
  detectSimpleSteps,
  preprocessForPoseEstimation,
  getOptimizedPoseConfig,
} from "./SimpleStepDetection";
import { isMediaPipeAvailable } from "./SafeMediaPipe";

/** ウィザードのステップ */
type WizardStep = 0 | 1 | 3 | 3.5 | 4 | 5 | 5.5 | 6 | 7 | 8 | 9;

/** 測定者情報 */
type AthleteInfo = {
  name: string;
  age: number | null;
  gender: "male" | "female" | "other" | null;
  affiliation: string;
  height_cm: number | null;
  current_record: string;
  target_record: string;
};

/** Supabase の running_analysis_sessions の型 */
type RunningAnalysisSession = {
  id: string;
  created_at: string;
  source_video_name: string | null;
  distance_m: number | null;
  frames_count: number | null;
  section_start_frame: number | null;
  section_end_frame: number | null;
  section_frame_count: number | null;
  section_time_s: number | null;
  avg_speed_mps: number | null;
  label: string | null;
  notes: string | null;
  target_fps: number | null;
};

/** 接地／離地マーカーから計算した 1 歩ごとのデータ */
type StepMetric = {
  index: number;
  contactFrame: number;
  toeOffFrame: number;
  nextContactFrame: number | null;
  contactTime: number | null;
  flightTime: number | null;
  stepTime: number | null;
  stepPitch: number | null;
  stride: number | null;
  speedMps: number | null;
  acceleration: number | null;
};

type MarkerMode = "semi" | "manual";

/** メモリ効率のための軽量フレームデータ */
type LightFrameData = {
  frameNumber: number;
  timestamp: number;
  landmarks: Float32Array; // x, y, z, visibility
};

/** つま先軌道データ（互換用） */
type ToeTrajectoryPoint = {
  frame: number;
  height: number;
  velocity: number;
  isDescending: boolean;
  isLowest: boolean;
  isRising: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** メモリ効率のための軽量ランドマーク変換 */
const compressLandmarks = (landmarks: any[]): Float32Array => {
  const compressed = new Float32Array(landmarks.length * 4);
  for (let i = 0; i < landmarks.length; i++) {
    compressed[i * 4] = landmarks[i]?.x ?? 0;
    compressed[i * 4 + 1] = landmarks[i]?.y ?? 0;
    compressed[i * 4 + 2] = landmarks[i]?.z ?? 0;
    compressed[i * 4 + 3] = landmarks[i]?.visibility ?? 0;
  }
  return compressed;
};

const sortUniqueFrames = (arr: number[]) => Array.from(new Set(arr)).sort((a, b) => a - b);

/** StepMetric を「型通り」に生成（不足項目は null） */
const buildStepMetrics = (contactFrames: number[], toeOffFrames: number[], fps: number): StepMetric[] => {
  const contacts = sortUniqueFrames(contactFrames);
  const toes = sortUniqueFrames(toeOffFrames);
  const fpsSafe = fps > 0 ? fps : 30;

  let toeIdx = 0;

  return contacts.map((c, i) => {
    while (toeIdx < toes.length && toes[toeIdx] <= c) toeIdx++;
    const toe = toeIdx < toes.length ? toes[toeIdx++] : c + 1;

    const nextContact = i + 1 < contacts.length ? contacts[i + 1] : null;

    const contactTime = (toe - c) / fpsSafe;
    const flightTime = nextContact != null ? (nextContact - toe) / fpsSafe : null;
    const stepTime = nextContact != null ? (nextContact - c) / fpsSafe : null;
    const stepPitch = stepTime && stepTime > 0 ? 1 / stepTime : null;

    return {
      index: i + 1,
      contactFrame: c,
      toeOffFrame: toe,
      nextContactFrame: nextContact,
      contactTime,
      flightTime,
      stepTime,
      stepPitch,
      stride: null,
      speedMps: null,
      acceleration: null,
    };
  });
};

const AppOptimized: React.FC<{ userProfile?: any }> = ({ userProfile }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);

  const [athleteInfo, setAthleteInfo] = useState<AthleteInfo>({
    name: "",
    age: null,
    gender: null,
    affiliation: "",
    height_cm: null,
    current_record: "",
    target_record: "",
  });

  // メモリ効率のための状態管理
  const [lightFrames, setLightFrames] = useState<LightFrameData[]>([]);
  const [toeTrajectory, setToeTrajectory] = useState<ToeTrajectoryPoint[]>([]);
  const [videoMetadata, setVideoMetadata] = useState({ width: 0, height: 0, fps: 30, totalFrames: 0 });

  // UI状態
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 再生用（解析用 video 要素とは別に、UI 表示用の URL を保持）
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // 分析結果
  const [contactFrames, setContactFrames] = useState<number[]>([]);
  const [toeOffFrames, setToeOffFrames] = useState<number[]>([]);
  const [stepMetrics, setStepMetrics] = useState<StepMetric[]>([]);
  const [runningEvaluation, setRunningEvaluation] = useState<RunningEvaluation | null>(null);

  // マーク方式（半自動 / 手動）
  const [markerMode, setMarkerMode] = useState<MarkerMode>("semi");

  // 半自動の結果を退避（手動⇄半自動で戻すため）
  const [semiContactFramesBackup, setSemiContactFramesBackup] = useState<number[] | null>(null);
  const [semiToeOffFramesBackup, setSemiToeOffFramesBackup] = useState<number[] | null>(null);
  const [semiStepMetricsBackup, setSemiStepMetricsBackup] = useState<StepMetric[] | null>(null);

  // 画面・デバイス対応
  const [isMobile, setIsMobile] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  // 参照
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // 現在フレーム取得（currentFrame 変数は使わない）
  const getCurrentFrameFromVideo = useCallback(() => {
    const fps = videoMetadata.fps || 30;
    const t = videoRef.current?.currentTime ?? 0;
    return Math.max(0, Math.round(t * fps));
  }, [videoMetadata.fps]);

  // 手動モード時のみ stepMetrics を更新（型通り）
  useEffect(() => {
    if (markerMode !== "manual") return;
    setStepMetrics(buildStepMetrics(contactFrames, toeOffFrames, videoMetadata.fps));
  }, [markerMode, contactFrames, toeOffFrames, videoMetadata.fps]);

  // モバイル検出
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(mobile);
      setOrientation(window.innerWidth > window.innerHeight ? "landscape" : "portrait");
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 簡易チャート（任意）：接地時間の推移
  useEffect(() => {
    if (!chartCanvasRef.current) return;

    // 破棄
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    if (stepMetrics.length === 0) return;

    const labels = stepMetrics.map((s) => String(s.index));
    const data = stepMetrics.map((s) => (s.contactTime ?? 0) * 1000); // ms

    chartInstanceRef.current = new Chart(chartCanvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "接地時間（ms）",
            data,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }, [stepMetrics]);

  // 解析が終わったら評価生成（シグネチャ不確実のため any で安全に）
useEffect(() => {
  if (stepMetrics.length === 0) return;

  try {
    const phaseAngles: any[] = []; // これ1回だけ

    const avg0 = (arr: Array<number | null | undefined>) => {
      const v = arr.filter((x): x is number => typeof x === "number" && !Number.isNaN(x));
      if (v.length === 0) return 0;
      return v.reduce((a, b) => a + b, 0) / v.length;
    };

    const stepSummary = {
      avgContact: avg0(stepMetrics.map((s) => s.contactTime)),
      avgFlight: avg0(stepMetrics.map((s) => s.flightTime)),
      avgStepPitch: avg0(stepMetrics.map((s) => s.stepPitch)),
      avgStride: avg0(stepMetrics.map((s) => s.stride)),
      avgSpeed: avg0(stepMetrics.map((s) => s.speedMps)),
    };

    const ev = generateRunningEvaluation(
      stepMetrics as any,
      phaseAngles,
      stepSummary as any,
      toeTrajectory as any
    );

    setRunningEvaluation(ev as any);
  } catch {
    // 評価生成が失敗しても解析は継続
  }
}, [stepMetrics, toeTrajectory]);



  // Supabase 保存（最小：失敗しても UI は止めない）
  const saveSessionToSupabase = useCallback(async () => {
    try {
      // ここはあなたの DB スキーマに依存するので、最低限の例に留めます
      // 既に保存ロジックが別にある場合は差し替えてください
      const payload: Partial<RunningAnalysisSession> = {
        source_video_name: videoUrl ? "uploaded_video" : imageUrl ? "uploaded_image" : null,
        frames_count: lightFrames.length,
        target_fps: videoMetadata.fps,
      };

      const { data, error: sbErr } = await supabase
        .from("running_analysis_sessions")
        .insert(payload as any)
        .select("id")
        .single();

      if (!sbErr && data?.id) setSessionId(String(data.id));
    } catch {
      // 無視（ローカル解析は続行）
    }
  }, [videoUrl, imageUrl, lightFrames.length, videoMetadata.fps]);

  // ステップ0: 動画/画像アップロード
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 前回の URL を解放
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setVideoUrl(null);
    setImageUrl(null);

    setError(null);
    setSessionId(null);
    setRunningEvaluation(null);

    // 画像
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      await handleImageUpload(file);
      return;
    }

    // 動画
    if (!file.type.startsWith("video/")) {
      setError("動画ファイルまたは画像ファイルを選択してください。");
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    setIsProcessing(true);
    setProcessingProgress(0);

    const timeoutId = setTimeout(() => {
      setError("処理がタイムアウトしました。ファイルサイズを小さくするか、別のファイルをお試しください。");
      setIsProcessing(false);
      setProcessingProgress(0);
    }, 120000);

    let workerVideo: HTMLVideoElement | null = null;

    try {
      if (!isMediaPipeAvailable()) {
        throw new Error("MediaPipe が利用できません。ブラウザを更新するか、別のブラウザをお試しください。");
      }

      workerVideo = document.createElement("video");
      workerVideo.src = url;
      workerVideo.muted = true;
      workerVideo.playsInline = true;

      await new Promise<void>((resolve) => {
        workerVideo!.onloadedmetadata = () => resolve();
      });

      const { videoWidth, videoHeight, duration } = workerVideo;
      const fps = 30; // 現状は固定（必要なら将来メタデータ推定）
      const totalFrames = Math.max(1, Math.floor(duration * fps));
      setVideoMetadata({ width: videoWidth, height: videoHeight, fps, totalFrames });

      // Canvas でフレーム抽出
      const canvas = document.createElement("canvas");
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      const frames: LightFrameData[] = [];
      const frameInterval = 1 / fps;

      // MediaPipe Pose（※実行環境で mp がロードされている前提）
      const mp = (window as any).mp;
      if (!mp?.tasks?.vision?.Pose) {
        throw new Error("MediaPipe Pose がロードされていません。");
      }

      const poseConfig = getOptimizedPoseConfig();
      const pose = new mp.tasks.vision.Pose(poseConfig);

      for (let i = 0; i < totalFrames; i++) {
        const time = i * frameInterval;
        workerVideo.currentTime = time;

        await new Promise<void>((resolve) => {
          workerVideo!.onseeked = () => resolve();
        });

        ctx.drawImage(workerVideo, 0, 0, videoWidth, videoHeight);

        // 前処理
        preprocessForPoseEstimation(canvas);

        // 姿勢推定
        try {
          const result = await pose.detect(canvas);
          const lm = result?.landmarks?.[0];
          if (lm && lm.length > 0) {
            frames.push({
              frameNumber: i,
              timestamp: time,
              landmarks: compressLandmarks(lm),
            });
          }
        } catch {
          // フレーム単位の失敗は無視
        }

        if (i % 10 === 0) setProcessingProgress((i / totalFrames) * 80);
      }

      setLightFrames(frames);

      // つま先軌道（簡素）
      const simpleTrajectory = analyzeSimpleToeTrajectory(frames);
      const trajectory: ToeTrajectoryPoint[] = simpleTrajectory.map((p: any) => ({
        frame: p.frame,
        height: p.height,
        velocity: p.velocity,
        isDescending: p.velocity > 0.1,
        isLowest: Math.abs(p.velocity) < 0.05,
        isRising: p.velocity < -0.1,
      }));
      setToeTrajectory(trajectory);

      // 半自動のステップ検出
      const steps = detectSimpleSteps(trajectory as any);

      const cFrames = steps.map((s: any) => s.contactFrame);
      const tFrames = steps.map((s: any) => s.toeOffFrame);

      // 半自動として反映
      setMarkerMode("semi");
      setContactFrames(cFrames);
      setToeOffFrames(tFrames);
      setStepMetrics(buildStepMetrics(cFrames, tFrames, fps));

      setProcessingProgress(100);
      setCurrentStep(3);

      // 保存は任意（失敗しても止めない）
      void saveSessionToSupabase();
    } catch (err) {
      setError(err instanceof Error ? err.message : "動画処理中にエラーが発生しました");
    } finally {
      clearTimeout(timeoutId);
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // 画像（スクリーンショット）アップロード処理
  const handleImageUpload = async (file: File) => {
    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);

    try {
      if (!isMediaPipeAvailable()) {
        throw new Error("MediaPipe が利用できません。ブラウザを更新するか、別のブラウザをお試しください。");
      }

      const img = new Image();
      img.src = URL.createObjectURL(file);

      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      ctx.drawImage(img, 0, 0);

      const mp = (window as any).mp;
      if (!mp?.tasks?.vision?.Pose) {
        throw new Error("MediaPipe Pose がロードされていません。");
      }

      const poseConfig = getOptimizedPoseConfig();
      const pose = new mp.tasks.vision.Pose(poseConfig);

      const result = await pose.detect(canvas);
      const lm = result?.landmarks?.[0];

      if (!lm || lm.length === 0) {
        throw new Error("姿勢を検出できませんでした");
      }

      const frames: LightFrameData[] = [
        {
          frameNumber: 0,
          timestamp: 0,
          landmarks: compressLandmarks(lm),
        },
      ];

      setLightFrames(frames);
      setVideoMetadata({ width: img.width, height: img.height, fps: 1, totalFrames: 1 });

      // 画像は手動前提
      setMarkerMode("manual");
      setContactFrames([]);
      setToeOffFrames([]);
      setStepMetrics([]);

      setCurrentStep(3.5);
      setProcessingProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像処理中にエラーが発生しました");
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // ===== UI =====
  const summaryText = useMemo(() => {
    const c = contactFrames.length;
    const t = toeOffFrames.length;
    const s = stepMetrics.length;
    return `接地: ${c} / 離地: ${t} / 歩数: ${s}`;
  }, [contactFrames.length, toeOffFrames.length, stepMetrics.length]);

  const MarkerModePanel = () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
      <div style={{ fontWeight: 700 }}>マーク設定：</div>

      <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <input
          type="radio"
          name="markerMode"
          checked={markerMode === "semi"}
          onChange={() => {
            setMarkerMode("semi");
            if (semiContactFramesBackup) setContactFrames(semiContactFramesBackup);
            if (semiToeOffFramesBackup) setToeOffFrames(semiToeOffFramesBackup);
            if (semiStepMetricsBackup) setStepMetrics(semiStepMetricsBackup);
          }}
        />
        半自動
      </label>

      <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <input
          type="radio"
          name="markerMode"
          checked={markerMode === "manual"}
          onChange={() => {
            setSemiContactFramesBackup((prev) => prev ?? contactFrames);
            setSemiToeOffFramesBackup((prev) => prev ?? toeOffFrames);
            setSemiStepMetricsBackup((prev) => prev ?? stepMetrics);

            setMarkerMode("manual");
            setContactFrames([]);
            setToeOffFrames([]);
            setStepMetrics([]);
          }}
        />
        手動
      </label>

      <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.9 }}>{summaryText}</div>
    </div>
  );

  const ManualPanel = () => (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => {
            const f = getCurrentFrameFromVideo();
            setContactFrames((prev) => sortUniqueFrames([...prev, f]));
          }}
        >
          接地を追加（現在フレーム）
        </button>

        <button
          type="button"
          onClick={() => {
            const f = getCurrentFrameFromVideo();
            setToeOffFrames((prev) => sortUniqueFrames([...prev, f]));
          }}
        >
          離地を追加（現在フレーム）
        </button>

        <button
          type="button"
          onClick={() => {
            setContactFrames([]);
            setToeOffFrames([]);
            setStepMetrics([]);
          }}
        >
          全削除
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8 }}>
        現在フレーム：{getCurrentFrameFromVideo()}（接地→離地→接地→離地…の順で追加）
      </div>
    </div>
  );

  const FramesList = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>接地フレーム</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {contactFrames.map((f, i) => (
            <span
              key={`c-${f}-${i}`}
              style={{ background: "rgba(0,0,0,0.35)", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}
            >
              {f}
            </span>
          ))}
          {contactFrames.length === 0 && <span style={{ fontSize: 12, opacity: 0.8 }}>なし</span>}
        </div>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>離地フレーム</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {toeOffFrames.map((f, i) => (
            <span
              key={`t-${f}-${i}`}
              style={{ background: "rgba(0,0,0,0.35)", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}
            >
              {f}
            </span>
          ))}
          {toeOffFrames.length === 0 && <span style={{ fontSize: 12, opacity: 0.8 }}>なし</span>}
        </div>
      </div>
    </div>
  );

  const renderMobileUI = () => {
    return (
      <div className="mobile-container">
        <div className="mobile-header">
          <h1 className="mobile-title">ランニング分析</h1>
          <p className="mobile-subtitle">AIがあなたの走りを分析します</p>
        </div>

        {currentStep === 0 && (
          <div className="mobile-step-0">
            <div className="mobile-upload-area" onClick={() => fileInputRef.current?.click()}>
              <i className="fas fa-video mobile-icon"></i>
              <p>動画または画像を選択</p>
              <small>HD 120p 2秒程度推奨、スクリーンショットも可</small>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </div>
        )}

        {isProcessing && (
          <div className="mobile-processing">
            <div className="mobile-progress-container">
              <div className="mobile-progress-bar" style={{ width: `${processingProgress}%` }}></div>
            </div>
            <p className="mobile-progress-text">{processingProgress.toFixed(0)}% 処理中...</p>
          </div>
        )}

        {error && (
          <div className="mobile-error">
            <i className="fas fa-exclamation-triangle"></i>
            <p>{error}</p>
            <button onClick={() => setError(null)}>閉じる</button>
          </div>
        )}

        {(currentStep === 3 || currentStep === 3.5) && (
          <div style={{ color: "white" }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>解析結果</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{summaryText}</div>
              {sessionId && <div style={{ fontSize: 12, opacity: 0.8 }}>sessionId: {sessionId}</div>}
            </div>

            {videoUrl && (
              <div style={{ marginBottom: 12 }}>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  style={{ width: "100%", borderRadius: 12, background: "#000" }}
                />
              </div>
            )}

            {imageUrl && (
              <div style={{ marginBottom: 12 }}>
                <img src={imageUrl} alt="uploaded" style={{ width: "100%", borderRadius: 12 }} />
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                style={{ padding: "10px 14px", borderRadius: 10 }}
              >
                マーク編集へ
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentStep(0);
                  setLightFrames([]);
                  setToeTrajectory([]);
                  setContactFrames([]);
                  setToeOffFrames([]);
                  setStepMetrics([]);
                  setRunningEvaluation(null);
                  setSessionId(null);
                }}
                style={{ padding: "10px 14px", borderRadius: 10 }}
              >
                最初に戻る
              </button>
            </div>

            <div style={{ height: 220, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>接地時間（参考）</div>
              <div style={{ position: "relative", height: 170 }}>
                <canvas ref={chartCanvasRef} />
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div style={{ color: "white" }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>接地/離地 マーク編集</div>

            <MarkerModePanel />

            {markerMode === "manual" && <ManualPanel />}

            <FramesList />

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                style={{ padding: "10px 14px", borderRadius: 10 }}
              >
                戻る
              </button>

              <button
                type="button"
                onClick={() => {
                  // semi の現在値をバックアップ（次回の戻し用）
                  if (markerMode === "semi") {
                    setSemiContactFramesBackup(contactFrames);
                    setSemiToeOffFramesBackup(toeOffFrames);
                    setSemiStepMetricsBackup(stepMetrics);
                  }
                  setCurrentStep(6);
                }}
                style={{ padding: "10px 14px", borderRadius: 10 }}
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div style={{ color: "white" }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>まとめ</div>
            <div style={{ marginBottom: 8 }}>{summaryText}</div>

            {runningEvaluation && (
              <div style={{ background: "rgba(255,255,255,0.1)", padding: 12, borderRadius: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>評価（参考）</div>
                <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12 }}>
                  {JSON.stringify(runningEvaluation, null, 2)}
                </pre>
              </div>
            )}

            <button
              type="button"
              onClick={() => setCurrentStep(0)}
              style={{ padding: "10px 14px", borderRadius: 10 }}
            >
              新しい動画で解析
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderDesktopUI = () => {
    return renderMobileUI();
  };

  return (
    <div className={`app-container ${isMobile ? "mobile" : "desktop"}`}>
      <div className="app-header">
        <h1>ランニングフォーム分析</h1>
        <div className="device-indicator">
          {isMobile ? (
            <>
              <i className="fas fa-mobile-alt"></i> モバイルモード
            </>
          ) : (
            <>
              <i className="fas fa-desktop"></i> デスクトップモード
            </>
          )}
        </div>
      </div>

      {isMobile ? renderMobileUI() : renderDesktopUI()}

      <style>{`
        .app-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: 'Noto Sans JP', sans-serif;
        }

        .mobile-container {
          padding: 16px;
          max-width: 100%;
        }

        .mobile-header {
          text-align: center;
          color: white;
          margin-bottom: 32px;
        }

        .mobile-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 8px;
        }

        .mobile-subtitle {
          font-size: 14px;
          opacity: 0.9;
        }

        .mobile-upload-area {
          background: rgba(255, 255, 255, 0.1);
          border: 2px dashed rgba(255, 255, 255, 0.3);
          border-radius: 16px;
          padding: 40px 20px;
          text-align: center;
          color: white;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .mobile-upload-area:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .mobile-icon {
          font-size: 48px;
          margin-bottom: 16px;
          display: block;
        }

        .mobile-processing {
          text-align: center;
          color: white;
          margin-top: 32px;
        }

        .mobile-progress-container {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          height: 8px;
          margin-bottom: 16px;
          overflow: hidden;
        }

        .mobile-progress-bar {
          background: #4CAF50;
          height: 100%;
          transition: width 0.3s ease;
        }

        .mobile-error {
          background: rgba(244, 67, 54, 0.9);
          color: white;
          padding: 16px;
          border-radius: 8px;
          margin-top: 16px;
          text-align: center;
        }

        .device-indicator {
          position: fixed;
          top: 16px;
          right: 16px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          z-index: 1000;
        }

        /* レスポンシブ */
        .mobile-container {
          max-width: 600px;
          margin: 0 auto;
        }

        button {
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default AppOptimized;
