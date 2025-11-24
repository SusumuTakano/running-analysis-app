import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  ChangeEvent,
} from "react";
import "./App.css";
import { supabase } from "./lib/supabaseClient";
import Chart from "chart.js/auto";

/** ウィザードのステップ */
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

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
};

/** 各フレームの姿勢推定結果 */
type FramePoseData = {
  landmarks: Array<{ x: number; y: number; z: number; visibility: number }>;
};

/** 関節角度データ */
type AngleData = {
  frame: number;
  trunkAngle: number | null;
  hipAnkleAngle: { left: number | null; right: number | null };
  thighAngle: { left: number | null; right: number | null };
  shankAngle: { left: number | null; right: number | null };
  kneeFlex: { left: number | null; right: number | null };
  ankleFlex: { left: number | null; right: number | null };
  elbowAngle: { left: number | null; right: number | null };
  toeHorizontalDistance: { left: number | null; right: number | null };
};

/** 3局面での角度データ */
type PhaseAngles = {
  phase: "initial" | "mid" | "late";
  frame: number;
  angles: Omit<AngleData, "frame">;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/** 角度計算 */
const calculateAngles = (
  landmarks: FramePoseData["landmarks"]
): Omit<AngleData, "frame"> => {
  const getPoint = (idx: number) => landmarks[idx];
  
  // 主要なランドマークの信頼度をチェック
  const CONFIDENCE_THRESHOLD = 0.5;

  const leftHip = getPoint(23);
  const rightHip = getPoint(24);
  const leftShoulder = getPoint(11);
  const rightShoulder = getPoint(12);
  
  // 主要なポイントの信頼度が低い場合、nullを返す
  if (
    leftHip.visibility < CONFIDENCE_THRESHOLD ||
    rightHip.visibility < CONFIDENCE_THRESHOLD ||
    leftShoulder.visibility < CONFIDENCE_THRESHOLD ||
    rightShoulder.visibility < CONFIDENCE_THRESHOLD
  ) {
    return {
      trunkAngle: null,
      hipAnkleAngle: { left: null, right: null },
      thighAngle: { left: null, right: null },
      shankAngle: { left: null, right: null },
      kneeFlex: { left: null, right: null },
      ankleFlex: { left: null, right: null },
      elbowAngle: { left: null, right: null },
      toeHorizontalDistance: { left: null, right: null },
    };
  }

  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };
  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };

  const dx = shoulderCenter.x - hipCenter.x;
  const dy = shoulderCenter.y - hipCenter.y;

  // 体幹角度: 垂直=90°、前傾で減少（80-40°）、後傾で増加（95-100°+）
  // atan2(dx, -dy) で計算し、垂直を基準に調整
  let trunkAngle = 90 - (Math.atan2(dx, -dy) * 180) / Math.PI;
  
  // 角度を0-180の範囲に正規化
  while (trunkAngle < 0) trunkAngle += 180;
  while (trunkAngle > 180) trunkAngle -= 180;

  const calcLegAngles = (side: "left" | "right") => {
    const hipIdx = side === "left" ? 23 : 24;
    const kneeIdx = side === "left" ? 25 : 26;
    const ankleIdx = side === "left" ? 27 : 28;
    const toeIdx = side === "left" ? 31 : 32;

    const hip = getPoint(hipIdx);
    const knee = getPoint(kneeIdx);
    const ankle = getPoint(ankleIdx);
    const toe = getPoint(toeIdx);

    // Hip-Ankle角度：腰から足首への角度（参考値）
    const hipAnkleAngle =
      (Math.atan2(ankle.x - hip.x, -(ankle.y - hip.y)) * 180) / Math.PI;

    // 大腿角度：鉛直下向きを0°として、前方がマイナス、後方がプラス
    // atan2(dx, dy)で計算し、符号を反転（右方向がマイナス、左方向がプラス）
    const dx = knee.x - hip.x;
    const dy = knee.y - hip.y; // yは下向きが正
    let thighAngle = (Math.atan2(dx, dy) * 180) / Math.PI;
    // 符号を反転：右（前方）をマイナス、左（後方）をプラス
    thighAngle = -thighAngle;

    // 下腿角度：鉛直下向きを0°として計算
    const shankDx = ankle.x - knee.x;
    const shankDy = ankle.y - knee.y;
    let shankAngle = (Math.atan2(shankDx, shankDy) * 180) / Math.PI;
    shankAngle = -shankAngle;

    const v1 = { x: knee.x - hip.x, y: knee.y - hip.y };
    const v2 = { x: ankle.x - knee.x, y: ankle.y - knee.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    const cosAngle = dot / (mag1 * mag2);
    const kneeAngleRad = Math.acos(clamp(cosAngle, -1, 1));
    const kneeFlex = 180 - (kneeAngleRad * 180) / Math.PI;

    const v3 = { x: toe.x - ankle.x, y: toe.y - ankle.y };
    const dot2 = v2.x * v3.x + v2.y * v3.y;
    const mag3 = Math.sqrt(v3.x * v3.x + v3.y * v3.y);
    const cosAngle2 = dot2 / (mag2 * mag3);
    const ankleAngleRad = Math.acos(clamp(cosAngle2, -1, 1));
    const ankleFlex = 180 - (ankleAngleRad * 180) / Math.PI;

    // 足先の水平距離を計算
    // 大転子（hip）から鉛直下方向に対する足先（toe）の水平距離
    // 正規化座標（0-1）なので、大腿長を基準にcm換算する
    const thighLength = mag1; // 大腿の長さ（正規化座標）
    const toeHorizontalOffset = toe.x - hip.x; // 水平方向のオフセット
    // 符号を反転：右（前方）をマイナス、左（後方）をプラス
    const toeHorizontalDistance = -toeHorizontalOffset;
    
    // 実際の距離に変換するため、平均的な大腿長を50cmと仮定
    // これにより、正規化座標を実際のcmに変換
    const ASSUMED_THIGH_LENGTH_CM = 50;
    const toeHorizontalDistanceCm = thighLength > 0 
      ? (toeHorizontalDistance / thighLength) * ASSUMED_THIGH_LENGTH_CM 
      : null;

    return {
      hipAnkleAngle,
      thighAngle,
      shankAngle,
      kneeFlex,
      ankleFlex,
      toeHorizontalDistanceCm,
    };
  };

  const left = calcLegAngles("left");
  const right = calcLegAngles("right");

  // 腕振り角度の計算（肘の屈曲角度）
  const calcElbowAngle = (side: "left" | "right"): number | null => {
    const shoulderIdx = side === "left" ? 11 : 12;
    const elbowIdx = side === "left" ? 13 : 14;
    const wristIdx = side === "left" ? 15 : 16;

    const shoulder = getPoint(shoulderIdx);
    const elbow = getPoint(elbowIdx);
    const wrist = getPoint(wristIdx);

    // 肘、肩、手首の信頼度をチェック
    if (
      shoulder.visibility < CONFIDENCE_THRESHOLD ||
      elbow.visibility < CONFIDENCE_THRESHOLD ||
      wrist.visibility < CONFIDENCE_THRESHOLD
    ) {
      return null;
    }

    // 肘角度の計算：上腕（肩→肘）と前腕（肘→手首）のベクトルから
    const v1 = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y };
    const v2 = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 === 0 || mag2 === 0) return null;
    
    const cosAngle = dot / (mag1 * mag2);
    const elbowAngleRad = Math.acos(clamp(cosAngle, -1, 1));
    // 肘屈曲角度：180° - アーク角度
    const elbowFlex = 180 - (elbowAngleRad * 180) / Math.PI;

    return elbowFlex;
  };

  const leftElbow = calcElbowAngle("left");
  const rightElbow = calcElbowAngle("right");

  return {
    trunkAngle,
    hipAnkleAngle: { left: left.hipAnkleAngle, right: right.hipAnkleAngle },
    thighAngle: { left: left.thighAngle, right: right.thighAngle },
    shankAngle: { left: left.shankAngle, right: right.shankAngle },
    kneeFlex: { left: left.kneeFlex, right: right.kneeFlex },
    ankleFlex: { left: left.ankleFlex, right: right.ankleFlex },
    elbowAngle: { left: leftElbow, right: rightElbow },
    toeHorizontalDistance: { left: left.toeHorizontalDistanceCm, right: right.toeHorizontalDistanceCm },
  };
};

/** グラフ用の指標キー */
type GraphMetricKey =
  | "contactTime"
  | "flightTime"
  | "stepPitch"
  | "stride"
  | "speedMps";

const metricLabels: Record<GraphMetricKey, string> = {
  contactTime: "接地時間 [s]",
  flightTime: "滞空時間 [s]",
  stepPitch: "ピッチ [歩/s]",
  stride: "ストライド [m]",
  speedMps: "スピード [m/s]",
};

const metricColors: Record<GraphMetricKey, string> = {
  contactTime: "#2563eb",
  flightTime: "#10b981",
  stepPitch: "#f97316",
  stride: "#7c3aed",
  speedMps: "#dc2626",
};

const App: React.FC = () => {
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  // ------------ 動画・フレーム関連 -----------------
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [status, setStatus] = useState<string>("");

  const framesRef = useRef<ImageData[]>([]);
  const [framesCount, setFramesCount] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [usedTargetFps, setUsedTargetFps] = useState<number | null>(null);

  // 足元拡大
  const [footZoomEnabled, setFootZoomEnabled] = useState(false);
  const [zoomScale, setZoomScale] = useState(3);

  // ------------ 姿勢推定関連 -----------------
  const [poseResults, setPoseResults] = useState<(FramePoseData | null)[]>([]);
  const [isPoseProcessing, setIsPoseProcessing] = useState(false);
  const [poseProgress, setPoseProgress] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(false);

  // ------------ 区間指定 ------------
  const [sectionStartFrame, setSectionStartFrame] = useState<number | null>(
    null
  );
  const [sectionMidFrame, setSectionMidFrame] = useState<number | null>(null);
  const [sectionEndFrame, setSectionEndFrame] = useState<number | null>(null);
  
  // 線の水平オフセット（ピクセル単位）
  const [startLineOffset, setStartLineOffset] = useState(0);
  const [midLineOffset, setMidLineOffset] = useState(0);
  const [endLineOffset, setEndLineOffset] = useState(0);

  const sectionRange = useMemo(() => {
    const rawStart = sectionStartFrame ?? 0;
    const start = Math.max(0, rawStart - 30);

    const end =
      sectionEndFrame ??
      (framesRef.current.length > 0 ? framesRef.current.length - 1 : 0);
    const count = end >= start ? end - start + 1 : 0;

    return { start, end, count, displayStart: rawStart };
  }, [sectionStartFrame, sectionEndFrame, framesCount]);

  const sectionTime =
    usedTargetFps && sectionRange.count > 0
      ? sectionRange.count / usedTargetFps
      : null;

  // ------------ 距離・速度・ラベル ---------------
  const [distanceInput, setDistanceInput] = useState<string>("10");
  const [labelInput, setLabelInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");

  const distanceValue = useMemo(() => {
    const d = parseFloat(distanceInput);
    return !isNaN(d) && d > 0 ? d : null;
  }, [distanceInput]);

  const avgSpeed =
    distanceValue != null && sectionTime != null && sectionTime > 0
      ? distanceValue / sectionTime
      : null;

  // ------------ 接地／離地マーカー ------------
  const [contactFrames, setContactFrames] = useState<number[]>([]);

  const handleClearMarkers = () => {
    setContactFrames([]);
  };

  // キーボード操作
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!framesCount) return;

      if (e.code === "Space") {
        e.preventDefault();
        setContactFrames((prev) => [...prev, currentFrame]);
        return;
      }

      if (e.code === "ArrowRight") {
        e.preventDefault();
        setCurrentFrame((prev) =>
          clamp(prev + 1, 0, Math.max(0, framesRef.current.length - 1))
        );
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        setCurrentFrame((prev) =>
          clamp(prev - 1, 0, Math.max(0, framesRef.current.length - 1))
        );
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setCurrentFrame((prev) =>
          clamp(prev + 10, 0, Math.max(0, framesRef.current.length - 1))
        );
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setCurrentFrame((prev) =>
          clamp(prev - 10, 0, Math.max(0, framesRef.current.length - 1))
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentFrame, framesCount]);

  // ------------ ステップメトリクス ------------
  const stepMetrics: StepMetric[] = useMemo(() => {
    if (!usedTargetFps) return [];
    if (contactFrames.length < 3) return [];

    let totalNormalizedDistance = 0;
    if (poseResults.length > 0) {
      for (let j = 0; j + 2 < contactFrames.length; j += 2) {
        const c1 = contactFrames[j];
        const c2 = contactFrames[j + 2];
        if (poseResults[c1]?.landmarks && poseResults[c2]?.landmarks) {
          const p1 = poseResults[c1]!.landmarks;
          const p2 = poseResults[c2]!.landmarks;
          const a1 = (p1[27].x + p1[28].x) / 2;
          const a2 = (p2[27].x + p2[28].x) / 2;
          totalNormalizedDistance += Math.abs(a2 - a1);
        }
      }
    }

    const metrics: StepMetric[] = [];

    for (let i = 0; i + 2 < contactFrames.length; i += 2) {
      const contact = contactFrames[i];
      const toeOff = contactFrames[i + 1];
      const nextContact = contactFrames[i + 2];

      const contactTime =
        toeOff > contact ? (toeOff - contact) / usedTargetFps : null;
      const flightTime =
        nextContact > toeOff ? (nextContact - toeOff) / usedTargetFps : null;
      const stepTime =
        nextContact > contact ? (nextContact - contact) / usedTargetFps : null;
      const stepPitch = stepTime && stepTime > 0 ? 1 / stepTime : null;

      let stride: number | null = null;

      if (
        poseResults.length > 0 &&
        poseResults[contact]?.landmarks &&
        nextContact != null &&
        poseResults[nextContact]?.landmarks
      ) {
        const pose1 = poseResults[contact]!.landmarks;
        const pose2 = poseResults[nextContact]!.landmarks;

        const ankle1X = (pose1[27].x + pose1[28].x) / 2;
        const ankle2X = (pose2[27].x + pose2[28].x) / 2;
        const normalizedStride = Math.abs(ankle2X - ankle1X);

        if (distanceValue != null && totalNormalizedDistance > 0) {
          stride =
            (normalizedStride / totalNormalizedDistance) * distanceValue;
        }
      } else if (distanceValue != null) {
        const totalSteps = Math.floor(contactFrames.length / 2);
        const denom = totalSteps > 0 ? totalSteps : 1;
        stride = distanceValue / denom;
      }

      const speedMps =
        stride != null && stepTime != null && stepTime > 0
          ? stride / stepTime
          : null;

      metrics.push({
        index: metrics.length + 1,
        contactFrame: contact,
        toeOffFrame: toeOff,
        nextContactFrame: nextContact ?? null,
        contactTime,
        flightTime,
        stepTime,
        stepPitch,
        stride,
        speedMps,
      });
    }
    return metrics;
  }, [contactFrames, usedTargetFps, poseResults, distanceValue]);

  const stepSummary = useMemo(() => {
    if (!stepMetrics.length) {
      return {
        stepCount: 0,
        avgContact: null as number | null,
        avgFlight: null as number | null,
        avgStepTime: null as number | null,
        avgStepPitch: null as number | null,
        avgStride: null as number | null,
        avgSpeedMps: null as number | null,
      };
    }

    let sumContact = 0,
      nContact = 0;
    let sumFlight = 0,
      nFlight = 0;
    let sumStep = 0,
      nStep = 0;
    let sumPitch = 0,
      nPitch = 0;
    let sumStride = 0,
      nStride = 0;
    let sumSpeed = 0,
      nSpeed = 0;

    for (const s of stepMetrics) {
      if (s.contactTime != null) {
        sumContact += s.contactTime;
        nContact++;
      }
      if (s.flightTime != null) {
        sumFlight += s.flightTime;
        nFlight++;
      }
      if (s.stepTime != null) {
        sumStep += s.stepTime;
        nStep++;
      }
      if (s.stepPitch != null) {
        sumPitch += s.stepPitch;
        nPitch++;
      }
      if (s.stride != null) {
        sumStride += s.stride;
        nStride++;
      }
      if (s.speedMps != null) {
        sumSpeed += s.speedMps;
        nSpeed++;
      }
    }

    const stepCount = nStep;
    const avgContact = nContact ? sumContact / nContact : null;
    const avgFlight = nFlight ? sumFlight / nFlight : null;
    const avgStepTime = nStep ? sumStep / nStep : null;
    const avgStepPitch = nPitch ? sumPitch / nPitch : null;
    const avgStride = nStride ? sumStride / nStride : null;
    const avgSpeedMps = nSpeed ? sumSpeed / nSpeed : null;

    return {
      stepCount,
      avgContact,
      avgFlight,
      avgStepTime,
      avgStepPitch,
      avgStride,
      avgSpeedMps,
    };
  }, [stepMetrics]);

  // 現在フレームの角度
  const currentAngles = useMemo((): AngleData | null => {
    if (!poseResults[currentFrame]?.landmarks) return null;
    const angles = calculateAngles(poseResults[currentFrame]!.landmarks);
    return { frame: currentFrame, ...angles };
  }, [currentFrame, poseResults]);

  // 3局面の角度計算（大腿角度ベース）
  // 接地期前半：接地時点（大腿が前方）
  // 接地期中半：大腿が鉛直（0°に最も近い時点）
  // 接地期後半：離地時点（大腿が後方）
  const threePhaseAngles = useMemo((): PhaseAngles[] => {
    if (contactFrames.length < 3 || poseResults.length === 0) return [];

    const results: PhaseAngles[] = [];

    // 各ステップ（接地から離地まで）を処理
    for (let i = 0; i + 1 < contactFrames.length; i += 2) {
      const contactFrame = contactFrames[i];
      const toeOffFrame = contactFrames[i + 1];

      if (toeOffFrame <= contactFrame) continue;

      // 接地期前半：接地時点のフレーム
      if (poseResults[contactFrame]?.landmarks) {
        const angles = calculateAngles(poseResults[contactFrame]!.landmarks);
        results.push({
          phase: "initial",
          frame: contactFrame,
          angles,
        });
      }

      // 接地期中半：大腿角度が0°に最も近いフレームを探す
      let minAngleDiff = Infinity;
      let midFrame = contactFrame;
      
      for (let f = contactFrame; f <= toeOffFrame; f++) {
        const pose = poseResults[f];
        if (!pose?.landmarks) continue;

        const angles = calculateAngles(pose.landmarks);
        // 左右の大腿角度の平均を取る（どちらが接地脚か不明なため）
        const avgThighAngle = (
          (angles.thighAngle.left ?? 0) + (angles.thighAngle.right ?? 0)
        ) / 2;
        const angleDiff = Math.abs(avgThighAngle);

        if (angleDiff < minAngleDiff) {
          minAngleDiff = angleDiff;
          midFrame = f;
        }
      }

      if (poseResults[midFrame]?.landmarks) {
        const angles = calculateAngles(poseResults[midFrame]!.landmarks);
        results.push({
          phase: "mid",
          frame: midFrame,
          angles,
        });
      }

      // 接地期後半：離地時点のフレーム
      if (poseResults[toeOffFrame]?.landmarks) {
        const angles = calculateAngles(poseResults[toeOffFrame]!.landmarks);
        results.push({
          phase: "late",
          frame: toeOffFrame,
          angles,
        });
      }
    }

    return results;
  }, [contactFrames, poseResults]);

  // ------------ 姿勢推定実行 ------------
  const runPoseEstimation = async () => {
    if (!framesRef.current.length) {
      alert("先にフレーム抽出を実行してください。");
      return;
    }

    setIsPoseProcessing(true);
    setPoseProgress(0);
    setStatus("姿勢推定を実行中...");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Pose: any = (window as any).Pose;

      if (!Pose) {
        throw new Error("MediaPipe Poseライブラリが読み込まれていません。");
      }

      const pose = new Pose({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      const results: (FramePoseData | null)[] = [];

      for (let i = 0; i < framesRef.current.length; i++) {
        const frame = framesRef.current[i];

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = frame.width;
        tempCanvas.height = frame.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) {
          results.push(null);
        } else {
          tempCtx.putImageData(frame, 0, 0);

          try {
            const result = await new Promise<any>((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error("Timeout")),
                5000
              );

              pose.onResults((r: any) => {
                clearTimeout(timeout);
                resolve(r);
              });

              pose.send({ image: tempCanvas }).catch(reject);
            });

            if (result.poseLandmarks) {
              results.push({
                landmarks: result.poseLandmarks.map((lm: any) => ({
                  x: lm.x,
                  y: lm.y,
                  z: lm.z,
                  visibility: lm.visibility ?? 0,
                })),
              });
            } else {
              results.push(null);
            }
          } catch (e) {
            console.error("Frame processing error:", e);
            results.push(null);
          }
        }

        const progress = Math.round(
          ((i + 1) / framesRef.current.length) * 100
        );
        setPoseProgress(progress);
        setStatus(
          `姿勢推定中... ${i + 1}/${framesRef.current.length} フレーム`
        );
      }

      setPoseResults(results);
      setStatus("✅ 姿勢推定完了！");
      
      // 自動で次のステップへ
      setTimeout(() => {
        setWizardStep(4);
      }, 1000);
    } catch (e: any) {
      console.error("Pose estimation error:", e);
      setStatus("❌ 姿勢推定でエラーが発生しました: " + e.message);
    } finally {
      setIsPoseProcessing(false);
    }
  };

  // ------------ スケルトン描画 ------------
  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    landmarks: FramePoseData["landmarks"],
    width: number,
    height: number
  ) => {
    // 信頼度のしきい値を高く設定（誤認識を減らす）
    const CONFIDENCE_THRESHOLD = 0.6;
    
    // 主要な関節の妥当性をチェック
    const isValidPose = () => {
      // 肩と腰の位置関係を確認
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      
      if (
        leftShoulder.visibility < CONFIDENCE_THRESHOLD ||
        rightShoulder.visibility < CONFIDENCE_THRESHOLD ||
        leftHip.visibility < CONFIDENCE_THRESHOLD ||
        rightHip.visibility < CONFIDENCE_THRESHOLD
      ) {
        return false;
      }
      
      // 肩が腰より上にあるか確認（基本的な姿勢チェック）
      const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const hipY = (leftHip.y + rightHip.y) / 2;
      
      if (shoulderY >= hipY) {
        return false; // 肩が腰より下にあるのは異常
      }
      
      return true;
    };
    
    // 姿勢が無効な場合は描画しない
    if (!isValidPose()) {
      return;
    }

    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2;

    const connections: [number, number][] = [
      [11, 12],
      [11, 13],
      [13, 15],
      [12, 14],
      [14, 16],
      [11, 23],
      [12, 24],
      [23, 24],
      [23, 25],
      [25, 27],
      [27, 31],
      [24, 26],
      [26, 28],
      [28, 32],
    ];

    connections.forEach(([a, b]) => {
      const pointA = landmarks[a];
      const pointB = landmarks[b];
      if (
        pointA &&
        pointB &&
        pointA.visibility > CONFIDENCE_THRESHOLD &&
        pointB.visibility > CONFIDENCE_THRESHOLD
      ) {
        // 2点間の距離が異常に遠い場合は描画しない
        const dx = (pointB.x - pointA.x) * width;
        const dy = (pointB.y - pointA.y) * height;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // フレーム幅の50%以上離れている接続は異常
        if (distance > width * 0.5) {
          return;
        }
        
        ctx.beginPath();
        ctx.moveTo(pointA.x * width, pointA.y * height);
        ctx.lineTo(pointB.x * width, pointB.y * height);
        ctx.stroke();
      }
    });

    ctx.fillStyle = "#f97316";
    landmarks.forEach((lm: FramePoseData["landmarks"][number]) => {
      if (lm.visibility > CONFIDENCE_THRESHOLD) {
        ctx.beginPath();
        ctx.arc(lm.x * width, lm.y * height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  // ------------ CSV エクスポート ------------
  const exportAnglesToCSV = () => {
    if (!poseResults.length) {
      alert("姿勢推定を先に実行してください。");
      return;
    }

    let csv =
      "Frame,Trunk_Angle,Left_HipAnkle,Right_HipAnkle,Left_Thigh_deg,Right_Thigh_deg,Left_Shank_deg,Right_Shank_deg,Left_Knee,Right_Knee,Left_Ankle,Right_Ankle,Left_Elbow,Right_Elbow,Left_Toe_Distance_cm,Right_Toe_Distance_cm\n" +
      "# 大腿角度(Thigh)と下腿角度(Shank)は鉛直下向きを0°、前方がマイナス、後方がプラス\n" +
      "# 足先距離(Toe_Distance)は大転子から鉛直下方向を0cm、前方がマイナス、後方がプラス\n";

    for (let i = 0; i < poseResults.length; i++) {
      const pose = poseResults[i];
      if (!pose?.landmarks) {
        csv += `${i},,,,,,,,,,,,,,,\n`;
        continue;
      }

      const angles = calculateAngles(pose.landmarks);
      csv += `${i},${angles.trunkAngle?.toFixed(2) ?? ""},${
        angles.hipAnkleAngle.left?.toFixed(2) ?? ""
      },${angles.hipAnkleAngle.right?.toFixed(2) ?? ""},${
        angles.thighAngle.left?.toFixed(2) ?? ""
      },${angles.thighAngle.right?.toFixed(2) ?? ""},${
        angles.shankAngle.left?.toFixed(2) ?? ""
      },${angles.shankAngle.right?.toFixed(2) ?? ""},${
        angles.kneeFlex.left?.toFixed(2) ?? ""
      },${angles.kneeFlex.right?.toFixed(2) ?? ""},${
        angles.ankleFlex.left?.toFixed(2) ?? ""
      },${angles.ankleFlex.right?.toFixed(2) ?? ""},${
        angles.elbowAngle.left?.toFixed(2) ?? ""
      },${angles.elbowAngle.right?.toFixed(2) ?? ""},${
        angles.toeHorizontalDistance.left?.toFixed(2) ?? ""
      },${angles.toeHorizontalDistance.right?.toFixed(2) ?? ""}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `angles_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ------------ Supabase 関連 ------------
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  const handleSaveSession = async () => {
    setSaveResult(null);
    const videoName = videoFile?.name ?? "(名称なし)";
    const distance_m = distanceValue;
    const section_frame_count =
      sectionRange.count > 0 ? sectionRange.count : null;
    const section_time_s = sectionTime;
    const avg_speed_mps = avgSpeed;

    try {
      setSaving(true);
      const payload = {
        source_video_name: videoName,
        distance_m,
        frames_count: framesCount || null,
        section_start_frame: sectionRange.start,
        section_end_frame: sectionRange.end,
        section_frame_count,
        section_time_s,
        avg_speed_mps,
        target_fps: usedTargetFps,
        label: labelInput || null,
        notes: notesInput || null,
      };

      const { data, error } = await supabase
        .from("running_analysis_sessions")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      setSaveResult(`✅ 保存成功: id=${(data as any).id ?? ""}`);
    } catch (e: any) {
      console.error(e);
      setSaveResult(`❌ 保存エラー: ${e.message ?? String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  // ------------ ファイル選択 & リセット ------------
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    framesRef.current = [];
    setFramesCount(0);
    setCurrentFrame(0);
    setExtractProgress(0);
    setUsedTargetFps(null);
    setStatus("");
    setSectionStartFrame(null);
    setSectionMidFrame(null);
    setSectionEndFrame(null);
    setStartLineOffset(0);
    setMidLineOffset(0);
    setEndLineOffset(0);
    setContactFrames([]);
    setPoseResults([]);

    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(url);
      
      // ビデオ要素の事前ロード
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
      }
    } else {
      setVideoFile(null);
      if (file) {
        alert("mp4 などの動画ファイルを選択してください。");
      }
    }
  };

  // ------------ フレーム抽出 ------------
  const handleExtractFrames = async () => {
    if (!videoFile) {
      alert("動画ファイルを選択してください。");
      setWizardStep(1);
      return;
    }
    
    // DOM要素の準備を確認
    let retryCount = 0;
    const maxRetries = 5;
    
    while ((!videoRef.current || !canvasRef.current) && retryCount < maxRetries) {
      console.log(`Waiting for DOM elements... retry ${retryCount + 1}`);
      await new Promise(resolve => setTimeout(resolve, 200));
      retryCount++;
    }
    
    if (!videoRef.current || !canvasRef.current) {
      alert("システムの初期化に失敗しました。もう一度お試しください。");
      setWizardStep(1);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      alert("キャンバスの初期化に失敗しました。");
      return;
    }

    setIsExtracting(true);
    setExtractProgress(0);
    setStatus("動画情報を読み込んでいます...");

    try {
      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          video.removeEventListener("loadedmetadata", onLoaded);
          video.removeEventListener("error", onError);
          resolve();
        };
        const onError = () => {
          video.removeEventListener("loadedmetadata", onLoaded);
          video.removeEventListener("error", onError);
          reject(new Error("動画の読み込みに失敗しました。"));
        };

        video.addEventListener("loadedmetadata", onLoaded);
        video.addEventListener("error", onError);

        if (videoUrl) {
          video.src = videoUrl;
        } else {
          const url = URL.createObjectURL(videoFile);
          setVideoUrl(url);
          video.src = url;
        }
      });
    } catch (err) {
      console.error(err);
      setIsExtracting(false);
      setStatus("❌ 動画の読み込みに失敗しました。");
      alert("動画の読み込みに失敗しました。別のファイルを選択してください。");
      setWizardStep(1);
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setIsExtracting(false);
      setStatus("❌ 動画サイズが取得できません。");
      return;
    }

    const duration = video.duration;
    const MAX_FRAMES = 1000;
    const preferredFps = 120;
    const maxFpsForLength = Math.floor(MAX_FRAMES / Math.max(duration, 0.001));
    const targetFps = Math.max(30, Math.min(preferredFps, maxFpsForLength));
    const dt = 1 / targetFps;
    const totalFrames = Math.max(1, Math.floor(duration * targetFps));

    setUsedTargetFps(targetFps);

    const MAX_WIDTH = 960;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const targetWidth = Math.round(video.videoWidth * scale);
    const targetHeight = Math.round(video.videoHeight * scale);

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    framesRef.current = [];
    setFramesCount(0);
    setCurrentFrame(0);

    setStatus(
      `フレーム抽出中... 長さ ${duration.toFixed(2)} 秒, fps ≒ ${targetFps}`
    );

    let index = 0;

    const grabFrame = () => {
      if (index >= totalFrames) {
        setIsExtracting(false);
        setExtractProgress(100);
        setFramesCount(framesRef.current.length);
        setCurrentFrame(0);
        setStatus(`✅ フレーム抽出完了（${framesRef.current.length} フレーム）`);
        
        // 自動で次のステップへ
        setTimeout(() => {
          setWizardStep(3);
          runPoseEstimation();
        }, 1000);
        return;
      }

      const currentTime = index * dt;

      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);

        requestAnimationFrame(() => {
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          framesRef.current.push(imageData);

          const progress = Math.round(((index + 1) / totalFrames) * 100);
          setExtractProgress(clamp(progress, 0, 99));
          setStatus(`フレーム抽出中... ${index + 1}/${totalFrames} フレーム`);

          index += 1;
          grabFrame();
        });
      };

      video.addEventListener("seeked", onSeeked);
      video.currentTime = clamp(currentTime, 0, duration);
    };

    grabFrame();
  };

  // ------------ 区間マーカー線を描画 ------------
  const drawSectionMarkers = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentFrameNum: number,
    viewParams?: { srcX: number; srcY: number; srcW: number; srcH: number; scale: number }
  ) => {
    const markers = [
      { frame: sectionStartFrame, color: "#10b981", label: "スタート", offset: startLineOffset },
      { frame: sectionMidFrame, color: "#f59e0b", label: "中間", offset: midLineOffset },
      { frame: sectionEndFrame, color: "#ef4444", label: "フィニッシュ", offset: endLineOffset },
    ];

    markers.forEach(({ frame, color, label, offset }) => {
      if (frame == null || frame !== currentFrameNum) return;

      // 姿勢推定から腰の位置を取得
      let torsoX: number | null = null;
      let fromPose = false;

      // まず姿勢推定データから腰の位置を取得しようとする
      if (poseResults.length > 0 && frame < poseResults.length && poseResults[frame]?.landmarks) {
        const landmarks = poseResults[frame]!.landmarks;
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];

        if (leftHip && rightHip && leftHip.visibility > 0.5 && rightHip.visibility > 0.5) {
          const hipCenterX = (leftHip.x + rightHip.x) / 2;
          fromPose = true;
          
          console.log(`[${label}] Frame ${frame}: Hip position found at X=${(hipCenterX * 100).toFixed(1)}%`);
          
          if (viewParams) {
            // 拡大表示時の座標変換
            const origX = hipCenterX * width;
            const relX = origX - viewParams.srcX;
            torsoX = (relX / viewParams.srcW) * width;
          } else {
            // 通常表示
            torsoX = hipCenterX * width;
          }
        } else {
          console.log(`[${label}] Frame ${frame}: Hip landmarks not visible (L:${leftHip?.visibility.toFixed(2)}, R:${rightHip?.visibility.toFixed(2)})`);
        }
      } else {
        console.log(`[${label}] Frame ${frame}: No pose data available (poseResults.length=${poseResults.length})`);
      }
      
      // 姿勢推定から取得できなかった場合のみデフォルト位置を使用
      if (torsoX === null) {
        torsoX = width / 2;
      }
      
      // 手動オフセットを適用
      torsoX += offset;

      // 画面内に収まるように調整
      torsoX = Math.max(20, Math.min(width - 20, torsoX));

      // 垂直線を描画
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(torsoX, height);
      ctx.lineTo(torsoX, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // ラベルの背景
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 14px sans-serif";
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(torsoX - textWidth / 2 - 8, 12, textWidth + 16, 24);
      
      // ラベルを描画
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(label, torsoX, 28);
      
      // 姿勢推定からの位置かどうかのインジケーター
      if (!fromPose) {
        ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
        ctx.font = "10px sans-serif";
        ctx.fillText("手動", torsoX, 45);
      }
    });
  };

  // ------------ 現在フレームの描画 ------------
  useEffect(() => {
    const canvas = displayCanvasRef.current;
    const frames = framesRef.current;
    if (!canvas || !frames.length) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const idx = clamp(currentFrame, 0, frames.length - 1);
    const frame = frames[idx];

    const w = frame.width;
    const h = frame.height;

    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;
    offCtx.putImageData(frame, 0, 0);

    canvas.width = w;
    canvas.height = h;

    if (!footZoomEnabled) {
      ctx.drawImage(offscreen, 0, 0, w, h, 0, 0, w, h);

      if (showSkeleton && poseResults[idx]?.landmarks) {
        drawSkeleton(ctx, poseResults[idx]!.landmarks, w, h);
      }
      
      // 区間マーカー線を描画
      drawSectionMarkers(ctx, w, h, currentFrame);
    } else {
      let footCenterY = 0.75;
      let footCenterX = 0.5;

      if (poseResults[idx]?.landmarks) {
        const landmarks = poseResults[idx]!.landmarks;
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        const leftFoot = landmarks[31];
        const rightFoot = landmarks[32];

        let validPoints = 0;
        let sumX = 0;
        let sumY = 0;

        if (leftAnkle.visibility > 0.5) {
          sumX += leftAnkle.x;
          sumY += leftAnkle.y;
          validPoints++;
        }
        if (rightAnkle.visibility > 0.5) {
          sumX += rightAnkle.x;
          sumY += rightAnkle.y;
          validPoints++;
        }

        if (validPoints > 0) {
          footCenterX = sumX / validPoints;
          footCenterY = sumY / validPoints;

          let footValidPoints = 0;
          let footSumY = 0;

          if (leftFoot.visibility > 0.5) {
            footSumY += leftFoot.y;
            footValidPoints++;
          }
          if (rightFoot.visibility > 0.5) {
            footSumY += rightFoot.y;
            footValidPoints++;
          }

          if (footValidPoints > 0) {
            const avgFootY = footSumY / footValidPoints;
            footCenterY = footCenterY * 0.7 + avgFootY * 0.3;
          }
        }
      }

      const srcW = w / zoomScale;
      const srcH = h / zoomScale;

      let srcX = footCenterX * w - srcW / 2;
      let srcY = footCenterY * h - srcH / 2;

      srcX = clamp(srcX, 0, w - srcW);
      srcY = clamp(srcY, 0, h - srcH);

      ctx.drawImage(offscreen, srcX, srcY, srcW, srcH, 0, 0, w, h);

      if (showSkeleton && poseResults[idx]?.landmarks) {
        const landmarks = poseResults[idx]!.landmarks;

        ctx.strokeStyle = "#0ea5e9";
        ctx.lineWidth = 3;

        const connections: [number, number][] = [
          [11, 12],
          [11, 13],
          [13, 15],
          [12, 14],
          [14, 16],
          [11, 23],
          [12, 24],
          [23, 24],
          [23, 25],
          [25, 27],
          [27, 31],
          [24, 26],
          [26, 28],
          [28, 32],
        ];

        const transformPoint = (lm: { x: number; y: number }) => {
          const origX = lm.x * w;
          const origY = lm.y * h;

          const relX = origX - srcX;
          const relY = origY - srcY;

          const canvasX = (relX / srcW) * w;
          const canvasY = (relY / srcH) * h;

          return { x: canvasX, y: canvasY };
        };

        connections.forEach(([a, b]) => {
          const pointA = landmarks[a];
          const pointB = landmarks[b];

          if (pointA.visibility > 0.5 && pointB.visibility > 0.5) {
            const transA = transformPoint(pointA);
            const transB = transformPoint(pointB);

            if (
              transA.x >= -10 &&
              transA.x <= w + 10 &&
              transA.y >= -10 &&
              transA.y <= h + 10 &&
              transB.x >= -10 &&
              transB.x <= w + 10 &&
              transB.y >= -10 &&
              transB.y <= h + 10
            ) {
              ctx.beginPath();
              ctx.moveTo(transA.x, transA.y);
              ctx.lineTo(transB.x, transB.y);
              ctx.stroke();
            }
          }
        });

        ctx.fillStyle = "#f97316";
        const POINT_CONFIDENCE_THRESHOLD = 0.6;
        landmarks.forEach((lm: FramePoseData["landmarks"][number]) => {
          if (lm.visibility > POINT_CONFIDENCE_THRESHOLD) {
            const trans = transformPoint(lm);

            if (
              trans.x >= -10 &&
              trans.x <= w + 10 &&
              trans.y >= -10 &&
              trans.y <= h + 10
            ) {
              ctx.beginPath();
              ctx.arc(trans.x, trans.y, 6, 0, 2 * Math.PI);
              ctx.fill();
            }
          }
        });
      }
      
      // 拡大表示時も区間マーカー線を描画
      drawSectionMarkers(ctx, w, h, currentFrame, {
        srcX,
        srcY,
        srcW,
        srcH,
        scale: zoomScale,
      });
    }
  }, [
    currentFrame,
    framesCount,
    footZoomEnabled,
    zoomScale,
    showSkeleton,
    poseResults,
    sectionStartFrame,
    sectionMidFrame,
    sectionEndFrame,
    startLineOffset,
    midLineOffset,
    endLineOffset,
  ]);

  const ready = framesCount > 0;

  const changeFrame = (delta: number) => {
    if (!ready) return;
    const newFrame = clamp(
      currentFrame + delta,
      0,
      Math.max(0, framesRef.current.length - 1)
    );
    setCurrentFrame(newFrame);
  };

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!ready) return;
    const idx = Number(e.target.value) || 0;
    setCurrentFrame(idx);
  };

  const currentLabel = ready ? currentFrame + 1 : 0;
  const maxLabel = ready ? framesCount : 0;

  // ------------ グラフ（Chart.js） ------------
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any | null>(null);
  const [selectedGraphMetrics, setSelectedGraphMetrics] = useState<
    GraphMetricKey[]
  >(["stride", "stepPitch", "speedMps"]);
  const [graphType, setGraphType] = useState<"line" | "bar">("line");

  const toggleMetric = (key: GraphMetricKey) => {
    setSelectedGraphMetrics((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((k) => k !== key);
        return next.length ? next : [key];
      }
      return [...prev, key];
    });
  };

  useEffect(() => {
    const canvas = graphCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!stepMetrics.length || !selectedGraphMetrics.length) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const labels = stepMetrics.map((s) => `#${s.index}`);

    const datasets = selectedGraphMetrics.map((key) => {
      const color = metricColors[key];
      const data = stepMetrics.map((s) => {
        const v = s[key];
        return v != null ? Number(v.toFixed(4)) : null;
      });

      return {
        label: metricLabels[key],
        data,
        type: graphType,
        borderColor: color,
        backgroundColor: graphType === "bar" ? `${color}33` : color,
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 3,
        pointHoverRadius: 4,
      };
    });

    chartInstanceRef.current = new Chart(ctx, {
      type: graphType,
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 350,
        },
        scales: {
          x: {
            grid: {
              color: "rgba(148, 163, 184, 0.15)",
            },
            ticks: {
              color: "#6b7280",
              font: {
                size: 11,
              },
            },
          },
          y: {
            grid: {
              color: "rgba(148, 163, 184, 0.15)",
            },
            ticks: {
              color: "#6b7280",
              font: {
                size: 11,
              },
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: "#374151",
              font: {
                size: 11,
              },
              boxWidth: 14,
            },
          },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#e5e7eb",
            bodyColor: "#e5e7eb",
            padding: 8,
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [stepMetrics, selectedGraphMetrics, graphType]);

  // ------------ ウィザードステップの内容 ------------
  const renderStepContent = () => {
    switch (wizardStep) {
      case 1:
        return (
          <div className="wizard-content">
            <div className="wizard-step-header">
              <h2 className="wizard-step-title">ステップ 1: 動画をアップロード</h2>
              <p className="wizard-step-desc">
                解析したいランニング動画を選択し、走行距離とラベルを入力してください。
              </p>
            </div>

            <div className="upload-area">
              <label className="upload-box" style={{
                borderColor: videoFile ? 'var(--success)' : 'var(--gray-300)',
                background: videoFile ? 'rgba(16, 185, 129, 0.05)' : 'var(--gray-50)'
              }}>
                <div className="upload-icon">{videoFile ? '✅' : '🎥'}</div>
                <div className="upload-text">
                  {videoFile ? (
                    <>
                      <strong style={{ color: 'var(--success)' }}>✓ {videoFile.name}</strong>
                      <span>クリックで別のファイルを選択</span>
                    </>
                  ) : (
                    <>
                      <strong>動画ファイルを選択</strong>
                      <span>MP4, MOV, AVI など</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-text">走行距離 (m) <span style={{ color: 'red' }}>*</span></span>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={distanceInput}
                  onChange={(e) => setDistanceInput(e.target.value)}
                  className="input-field"
                  placeholder="例: 10"
                  style={{
                    borderColor: distanceValue && distanceValue > 0 ? 'var(--success)' : 'var(--gray-300)'
                  }}
                />
                {distanceValue && distanceValue > 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>✓ 入力済み</span>
                )}
              </label>

              <label className="input-label">
                <span className="label-text">ラベル（任意）</span>
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  className="input-field"
                  placeholder="例: 前半5m"
                />
              </label>

              <label className="input-label">
                <span className="label-text">メモ（任意）</span>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="textarea-field"
                  placeholder="メモを入力..."
                  rows={3}
                />
              </label>
            </div>

            <div className="wizard-actions">
              <button
                className="btn-primary-large"
                onClick={() => {
                  if (!videoFile) {
                    alert("動画ファイルを選択してください。");
                    return;
                  }
                  if (!distanceValue || distanceValue <= 0) {
                    alert("有効な距離を入力してください。");
                    return;
                  }
                  
                  // ステップ2に移動してからフレーム抽出を開始
                  setWizardStep(2);
                  
                  // DOM更新を待ってから実行
                  setTimeout(() => {
                    handleExtractFrames();
                  }, 300);
                }}
                disabled={!videoFile || !distanceValue || distanceValue <= 0}
              >
                次へ：フレーム抽出
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="wizard-content">
            <div className="wizard-step-header">
              <h2 className="wizard-step-title">ステップ 2: フレーム抽出中</h2>
              <p className="wizard-step-desc">
                動画からフレームを抽出しています。しばらくお待ちください。
              </p>
            </div>

            <div className="progress-area">
              <div className="progress-circle">
                <svg viewBox="0 0 100 100" className="progress-ring">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="8"
                    strokeDasharray={`${extractProgress * 2.827}, 282.7`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="progress-text">{extractProgress}%</div>
              </div>
              <div className="progress-status">{status}</div>
            </div>
            
            {status.includes('❌') && (
              <div className="wizard-actions">
                <button className="btn-ghost" onClick={() => setWizardStep(1)}>
                  最初に戻る
                </button>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="wizard-content">
            <div className="wizard-step-header">
              <h2 className="wizard-step-title">ステップ 3: 姿勢推定中</h2>
              <p className="wizard-step-desc">
                各フレームから姿勢を推定しています。しばらくお待ちください。
              </p>
            </div>

            <div className="progress-area">
              <div className="progress-circle">
                <svg viewBox="0 0 100 100" className="progress-ring">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="8"
                    strokeDasharray={`${poseProgress * 2.827}, 282.7`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="progress-text">{poseProgress}%</div>
              </div>
              <div className="progress-status">{status}</div>
            </div>
            
            {status.includes('❌') && (
              <div className="wizard-actions">
                <button className="btn-ghost" onClick={() => setWizardStep(1)}>
                  最初に戻る
                </button>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="wizard-content">
            <div className="wizard-step-header">
              <h2 className="wizard-step-title">ステップ 4: 区間設定</h2>
              <p className="wizard-step-desc">
                解析する区間の開始フレームと終了フレームを設定してください。
              </p>
            </div>

            <div className="canvas-area">
              <canvas ref={displayCanvasRef} className="preview-canvas" />
            </div>

            <div className="frame-control">
              <div className="frame-info">
                フレーム: {currentLabel} / {maxLabel}
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(ready ? framesCount - 1 : 0, 0)}
                step={1}
                value={ready ? currentFrame : 0}
                onChange={handleSliderChange}
                disabled={!ready}
                className="frame-range"
              />
              <div className="frame-buttons-compact">
                <button onClick={() => changeFrame(-10)} disabled={!ready}>
                  -10
                </button>
                <button onClick={() => changeFrame(-1)} disabled={!ready}>
                  -1
                </button>
                <button onClick={() => changeFrame(1)} disabled={!ready}>
                  +1
                </button>
                <button onClick={() => changeFrame(10)} disabled={!ready}>
                  +10
                </button>
              </div>
            </div>

            <div className="section-settings">
              <div className="section-markers-info">
                <p className="info-text">
                  📍 各ポイントを設定すると、腰の位置に垂直線が表示されます。
                </p>
              </div>

              <div className="section-item">
                <div className="section-label">
                  <div className="marker-badge start">スタート</div>
                  <strong>フレーム:</strong>{" "}
                  {sectionStartFrame ?? "未設定"}
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSectionStartFrame(currentFrame);
                    setStartLineOffset(0);
                  }}
                  disabled={!ready}
                >
                  🟢 現在位置を設定
                </button>
              </div>
              {sectionStartFrame != null && (
                <div className="line-adjust-control">
                  <label className="adjust-label">
                    <span>線の位置調整:</span>
                    <div className="adjust-slider-container">
                      <button
                        className="adjust-btn"
                        onClick={() => setStartLineOffset((prev) => prev - 10)}
                      >
                        ◀
                      </button>
                      <input
                        type="range"
                        min={-200}
                        max={200}
                        step={1}
                        value={startLineOffset}
                        onChange={(e) => setStartLineOffset(Number(e.target.value))}
                        className="adjust-slider"
                      />
                      <button
                        className="adjust-btn"
                        onClick={() => setStartLineOffset((prev) => prev + 10)}
                      >
                        ▶
                      </button>
                      <span className="adjust-value">{startLineOffset}px</span>
                      <button
                        className="adjust-reset"
                        onClick={() => setStartLineOffset(0)}
                      >
                        リセット
                      </button>
                    </div>
                  </label>
                </div>
              )}

              <div className="section-item">
                <div className="section-label">
                  <div className="marker-badge mid">中間（任意）</div>
                  <strong>フレーム:</strong>{" "}
                  {sectionMidFrame ?? "未設定"}
                </div>
                <div className="section-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setSectionMidFrame(currentFrame);
                      setMidLineOffset(0);
                    }}
                    disabled={!ready}
                  >
                    🟡 現在位置を設定
                  </button>
                  {sectionMidFrame != null && (
                    <button
                      className="btn-ghost-small"
                      onClick={() => {
                        setSectionMidFrame(null);
                        setMidLineOffset(0);
                      }}
                    >
                      クリア
                    </button>
                  )}
                </div>
              </div>
              {sectionMidFrame != null && (
                <div className="line-adjust-control">
                  <label className="adjust-label">
                    <span>線の位置調整:</span>
                    <div className="adjust-slider-container">
                      <button
                        className="adjust-btn"
                        onClick={() => setMidLineOffset((prev) => prev - 10)}
                      >
                        ◀
                      </button>
                      <input
                        type="range"
                        min={-200}
                        max={200}
                        step={1}
                        value={midLineOffset}
                        onChange={(e) => setMidLineOffset(Number(e.target.value))}
                        className="adjust-slider"
                      />
                      <button
                        className="adjust-btn"
                        onClick={() => setMidLineOffset((prev) => prev + 10)}
                      >
                        ▶
                      </button>
                      <span className="adjust-value">{midLineOffset}px</span>
                      <button
                        className="adjust-reset"
                        onClick={() => setMidLineOffset(0)}
                      >
                        リセット
                      </button>
                    </div>
                  </label>
                </div>
              )}

              <div className="section-item">
                <div className="section-label">
                  <div className="marker-badge end">フィニッシュ</div>
                  <strong>フレーム:</strong>{" "}
                  {sectionEndFrame ?? "未設定"}
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSectionEndFrame(currentFrame);
                    setEndLineOffset(0);
                  }}
                  disabled={!ready}
                >
                  🔴 現在位置を設定
                </button>
              </div>
              {sectionEndFrame != null && (
                <div className="line-adjust-control">
                  <label className="adjust-label">
                    <span>線の位置調整:</span>
                    <div className="adjust-slider-container">
                      <button
                        className="adjust-btn"
                        onClick={() => setEndLineOffset((prev) => prev - 10)}
                      >
                        ◀
                      </button>
                      <input
                        type="range"
                        min={-200}
                        max={200}
                        step={1}
                        value={endLineOffset}
                        onChange={(e) => setEndLineOffset(Number(e.target.value))}
                        className="adjust-slider"
                      />
                      <button
                        className="adjust-btn"
                        onClick={() => setEndLineOffset((prev) => prev + 10)}
                      >
                        ▶
                      </button>
                      <span className="adjust-value">{endLineOffset}px</span>
                      <button
                        className="adjust-reset"
                        onClick={() => setEndLineOffset(0)}
                      >
                        リセット
                      </button>
                    </div>
                  </label>
                </div>
              )}

              <div className="section-summary">
                <div>区間フレーム数: {sectionRange.count}</div>
                <div>
                  区間時間: {sectionTime != null ? sectionTime.toFixed(3) : "ー"} 秒
                </div>
                <div>
                  平均速度: {avgSpeed != null ? avgSpeed.toFixed(3) : "ー"} m/s
                </div>
              </div>
            </div>

            <div className="wizard-actions">
              <button className="btn-ghost" onClick={() => setWizardStep(1)}>
                最初に戻る
              </button>
              <button
                className="btn-primary-large"
                onClick={() => setWizardStep(5)}
              >
                次へ：マーカー打ち
              </button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="wizard-content">
            <div className="wizard-step-header">
              <h2 className="wizard-step-title">ステップ 5: 接地/離地マーカー</h2>
              <p className="wizard-step-desc">
                Spaceキーで接地・離地のタイミングにマーカーを打ってください。
                <br />
                <small>矢印キー: ←→ (1フレーム移動) / ↑↓ (10フレーム移動)</small>
              </p>
            </div>

            <div className="marker-controls">
              <button
                className={
                  footZoomEnabled ? "toggle-btn active" : "toggle-btn"
                }
                onClick={() => setFootZoomEnabled((v) => !v)}
              >
                足元拡大 {footZoomEnabled ? "ON" : "OFF"}
              </button>
              {footZoomEnabled && (
                <label className="zoom-control">
                  倍率:
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.5}
                    value={zoomScale}
                    onChange={(e) => setZoomScale(Number(e.target.value))}
                  />
                  {zoomScale.toFixed(1)}x
                </label>
              )}
              <button
                className={showSkeleton ? "toggle-btn active" : "toggle-btn"}
                onClick={() => setShowSkeleton((v) => !v)}
                disabled={!poseResults.length}
              >
                スケルトン {showSkeleton ? "ON" : "OFF"}
              </button>
              <button className="btn-ghost-small" onClick={handleClearMarkers}>
                マーカークリア
              </button>
            </div>

            <div className="canvas-area">
              <canvas ref={displayCanvasRef} className="preview-canvas" />
            </div>

            <div className="frame-control">
              <div className="frame-info">
                フレーム: {currentLabel} / {maxLabel} | マーカー数:{" "}
                {contactFrames.length}
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(ready ? framesCount - 1 : 0, 0)}
                step={1}
                value={ready ? currentFrame : 0}
                onChange={handleSliderChange}
                disabled={!ready}
                className="frame-range"
              />
              <div className="frame-buttons-compact">
                <button onClick={() => changeFrame(-10)} disabled={!ready}>
                  -10
                </button>
                <button onClick={() => changeFrame(-1)} disabled={!ready}>
                  -1
                </button>
                <button onClick={() => changeFrame(1)} disabled={!ready}>
                  +1
                </button>
                <button onClick={() => changeFrame(10)} disabled={!ready}>
                  +10
                </button>
              </div>
            </div>

            {currentAngles && (
              <div className="angle-display-compact">
                <h4>現在フレームの角度</h4>
                <div className="angle-grid-compact">
                  <div>
                    体幹: {currentAngles.trunkAngle?.toFixed(1)}°
                    <span style={{ fontSize: '0.7rem', marginLeft: '4px', color: 'var(--gray-500)' }}>
                      {currentAngles.trunkAngle && currentAngles.trunkAngle < 85 ? '(前傾)' : 
                       currentAngles.trunkAngle && currentAngles.trunkAngle > 95 ? '(後傾)' : '(垂直)'}
                    </span>
                  </div>
                  <div>
                    左膝: {currentAngles.kneeFlex.left?.toFixed(1)}°
                  </div>
                  <div>
                    右膝: {currentAngles.kneeFlex.right?.toFixed(1)}°
                  </div>
                  <div>
                    左肘: {currentAngles.elbowAngle.left?.toFixed(1) ?? 'ー'}°
                  </div>
                  <div>
                    右肘: {currentAngles.elbowAngle.right?.toFixed(1) ?? 'ー'}°
                  </div>
                </div>
              </div>
            )}

            <div className="wizard-actions">
              <button className="btn-ghost" onClick={() => setWizardStep(4)}>
                前へ
              </button>
              <button
                className="btn-primary-large"
                onClick={() => setWizardStep(6)}
              >
                次へ：解析結果
              </button>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="wizard-content">
            <div className="wizard-step-header">
              <h2 className="wizard-step-title">ステップ 6: 解析結果</h2>
              <p className="wizard-step-desc">
                ステップ解析結果とグラフを確認できます。スライダーで各フレームの角度を確認できます。
              </p>
            </div>

            {/* フレームビューアー */}
            <div className="result-viewer-card">
              <div className="viewer-controls">
                <button
                  className={footZoomEnabled ? "toggle-btn active" : "toggle-btn"}
                  onClick={() => setFootZoomEnabled((v) => !v)}
                >
                  足元拡大 {footZoomEnabled ? "ON" : "OFF"}
                </button>
                {footZoomEnabled && (
                  <label className="zoom-control">
                    倍率:
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={0.5}
                      value={zoomScale}
                      onChange={(e) => setZoomScale(Number(e.target.value))}
                    />
                    {zoomScale.toFixed(1)}x
                  </label>
                )}
                <button
                  className={showSkeleton ? "toggle-btn active" : "toggle-btn"}
                  onClick={() => setShowSkeleton((v) => !v)}
                  disabled={!poseResults.length}
                >
                  スケルトン {showSkeleton ? "ON" : "OFF"}
                </button>
              </div>

              <div className="canvas-area">
                <canvas ref={displayCanvasRef} className="preview-canvas" />
              </div>

              <div className="frame-control">
                <div className="frame-info">
                  フレーム: {currentLabel} / {maxLabel}
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(ready ? framesCount - 1 : 0, 0)}
                  step={1}
                  value={ready ? currentFrame : 0}
                  onChange={handleSliderChange}
                  disabled={!ready}
                  className="frame-range"
                />
                <div className="frame-buttons-compact">
                  <button onClick={() => changeFrame(-10)} disabled={!ready}>
                    -10
                  </button>
                  <button onClick={() => changeFrame(-1)} disabled={!ready}>
                    -1
                  </button>
                  <button onClick={() => changeFrame(1)} disabled={!ready}>
                    +1
                  </button>
                  <button onClick={() => changeFrame(10)} disabled={!ready}>
                    +10
                  </button>
                </div>
              </div>

              {/* 現在フレームの関節角度（フレームスライダー連動） */}
              {currentAngles && (
                <div className="angle-display-result">
                  <h4>現在フレーム ({currentFrame}) の関節角度と足先距離</h4>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                    ※ 大腿角度：鉛直下向きを0°、前方がマイナス（-）、後方がプラス（+）<br/>
                    ※ 足先距離：大転子から鉛直下方向を0cm、前方がマイナス（-）、後方がプラス（+）
                  </p>
                  
                  <div className="angle-grid-result">
                    <div className="angle-item">
                      <span className="angle-label">体幹角度</span>
                      <span className="angle-value">{currentAngles.trunkAngle?.toFixed(1)}°</span>
                      <span className="angle-hint">
                        {currentAngles.trunkAngle && currentAngles.trunkAngle < 85 ? '前傾' : 
                         currentAngles.trunkAngle && currentAngles.trunkAngle > 95 ? '後傾' : '垂直'}
                      </span>
                    </div>
                    <div className="angle-item">
                      <span className="angle-label">左 大腿角</span>
                      <span className="angle-value">{currentAngles.thighAngle.left?.toFixed(1)}°</span>
                    </div>
                    <div className="angle-item">
                      <span className="angle-label">右 大腿角</span>
                      <span className="angle-value">{currentAngles.thighAngle.right?.toFixed(1)}°</span>
                    </div>
                    <div className="angle-item">
                      <span className="angle-label">左 足先距離</span>
                      <span className="angle-value">{currentAngles.toeHorizontalDistance.left?.toFixed(1) ?? 'ー'}cm</span>
                    </div>
                    <div className="angle-item">
                      <span className="angle-label">右 足先距離</span>
                      <span className="angle-value">{currentAngles.toeHorizontalDistance.right?.toFixed(1) ?? 'ー'}cm</span>
                    </div>
                    <div className="angle-item">
                      <span className="angle-label">左 膝屈曲</span>
                      <span className="angle-value">{currentAngles.kneeFlex.left?.toFixed(1)}°</span>
                    </div>
                    <div className="angle-item">
                      <span className="angle-label">右 膝屈曲</span>
                      <span className="angle-value">{currentAngles.kneeFlex.right?.toFixed(1)}°</span>
                    </div>
                    <div className="angle-item">
                      <span className="angle-label">左 足首</span>
                      <span className="angle-value">{currentAngles.ankleFlex.left?.toFixed(1)}°</span>
                    </div>
                    <div className="angle-item">
                      <span className="angle-label">右 足首</span>
                      <span className="angle-value">{currentAngles.ankleFlex.right?.toFixed(1)}°</span>
                    </div>
                    <div className="angle-item">
                      <span className="angle-label">左 肘屈曲</span>
                      <span className="angle-value">{currentAngles.elbowAngle.left?.toFixed(1) ?? 'ー'}°</span>
                    </div>
                    <div className="angle-item">
                      <span className="angle-label">右 肘屈曲</span>
                      <span className="angle-value">{currentAngles.elbowAngle.right?.toFixed(1) ?? 'ー'}°</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="results-layout">
              {/* ステップメトリクス */}
              <div className="result-card">
                <h3 className="result-card-title">ステップメトリクス</h3>
                {stepMetrics.length > 0 ? (
                  <>
                    <div className="metrics-summary">
                      <div className="metric-item">
                        <span className="metric-label">ステップ数</span>
                        <span className="metric-value">{stepSummary.stepCount}</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">平均接地時間</span>
                        <span className="metric-value">
                          {stepSummary.avgContact != null
                            ? stepSummary.avgContact.toFixed(3)
                            : "ー"}{" "}
                          s
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">平均滞空時間</span>
                        <span className="metric-value">
                          {stepSummary.avgFlight != null
                            ? stepSummary.avgFlight.toFixed(3)
                            : "ー"}{" "}
                          s
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">平均ピッチ</span>
                        <span className="metric-value">
                          {stepSummary.avgStepPitch != null
                            ? stepSummary.avgStepPitch.toFixed(2)
                            : "ー"}{" "}
                          歩/s
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">平均ストライド</span>
                        <span className="metric-value">
                          {stepSummary.avgStride != null
                            ? stepSummary.avgStride.toFixed(2)
                            : "ー"}{" "}
                          m
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">平均スピード</span>
                        <span className="metric-value">
                          {stepSummary.avgSpeedMps != null
                            ? stepSummary.avgSpeedMps.toFixed(2)
                            : "ー"}{" "}
                          m/s
                        </span>
                      </div>
                    </div>

                    <div className="table-scroll">
                      <table className="metrics-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>接地</th>
                            <th>離地</th>
                            <th>接地時間</th>
                            <th>滞空時間</th>
                            <th>ピッチ</th>
                            <th>ストライド</th>
                            <th>スピード</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stepMetrics.map((s) => (
                            <tr key={s.index}>
                              <td>{s.index}</td>
                              <td>{s.contactFrame}</td>
                              <td>{s.toeOffFrame}</td>
                              <td>{s.contactTime?.toFixed(3) ?? "ー"}</td>
                              <td>{s.flightTime?.toFixed(3) ?? "ー"}</td>
                              <td>{s.stepPitch?.toFixed(2) ?? "ー"}</td>
                              <td>{s.stride?.toFixed(2) ?? "ー"}</td>
                              <td>{s.speedMps?.toFixed(2) ?? "ー"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    マーカーを打つとステップメトリクスが表示されます
                  </div>
                )}
              </div>

              {/* グラフ */}
              <div className="result-card">
                <h3 className="result-card-title">ステップ解析グラフ</h3>

                {stepMetrics.length > 0 ? (
                  <>
                    <div className="graph-controls-compact">
                      <div className="metric-chips-compact">
                        {(Object.keys(metricLabels) as GraphMetricKey[]).map(
                          (key) => {
                            const active = selectedGraphMetrics.includes(key);
                            return (
                              <button
                                key={key}
                                className={
                                  active
                                    ? "metric-chip active"
                                    : "metric-chip"
                                }
                                onClick={() => toggleMetric(key)}
                              >
                                {metricLabels[key]}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <div className="graph-type-switch">
                        <button
                          className={
                            graphType === "line"
                              ? "type-btn active"
                              : "type-btn"
                          }
                          onClick={() => setGraphType("line")}
                        >
                          折れ線
                        </button>
                        <button
                          className={
                            graphType === "bar" ? "type-btn active" : "type-btn"
                          }
                          onClick={() => setGraphType("bar")}
                        >
                          棒グラフ
                        </button>
                      </div>
                    </div>

                    <div className="graph-container">
                      <canvas ref={graphCanvasRef} />
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    マーカーを打つとグラフが表示されます
                  </div>
                )}
              </div>

              {/* 3局面角度テーブル */}
              {threePhaseAngles.length > 0 && (
                <div className="result-card">
                  <h3 className="result-card-title">3局面の関節角度と足先距離（詳細データ）</h3>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    ※ 接地期前半：接地脚が大転子から鉛直に下ろした線より前方にある接地ポイント<br/>
                    ※ 接地期中半：接地脚が大転子から鉛直に下ろした線と重なる接地ポイント（大腿角0°）<br/>
                    ※ 接地期後半：接地脚が大転子から鉛直に下ろした線より後方にある離地ポイント
                  </p>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
                    ※ 大腿角度：鉛直下向きを0°、前方がマイナス（-）、後方がプラス（+）<br/>
                    ※ 足先距離：大転子から鉛直下方向を0cm、前方がマイナス（-）、後方がプラス（+）
                  </p>
                  <div className="table-scroll">
                    <table className="phase-table-compact">
                      <thead>
                        <tr>
                          <th>局面</th>
                          <th>フレーム</th>
                          <th>体幹</th>
                          <th>L 大腿</th>
                          <th>R 大腿</th>
                          <th>L 足先距離</th>
                          <th>R 足先距離</th>
                          <th>L 膝</th>
                          <th>R 膝</th>
                          <th>L 肘</th>
                          <th>R 肘</th>
                        </tr>
                      </thead>
                      <tbody>
                        {threePhaseAngles.map((p, i) => (
                          <tr key={i}>
                            <td>{p.phase === 'initial' ? '接地期前半（接地）' : p.phase === 'mid' ? '接地期中半（垂直）' : '接地期後半（離地）'}</td>
                            <td>{p.frame}</td>
                            <td>{p.angles.trunkAngle?.toFixed(1)}°</td>
                            <td>{p.angles.thighAngle.left?.toFixed(1)}°</td>
                            <td>{p.angles.thighAngle.right?.toFixed(1)}°</td>
                            <td>{p.angles.toeHorizontalDistance.left?.toFixed(1) ?? 'ー'}cm</td>
                            <td>{p.angles.toeHorizontalDistance.right?.toFixed(1) ?? 'ー'}cm</td>
                            <td>{p.angles.kneeFlex.left?.toFixed(1)}°</td>
                            <td>{p.angles.kneeFlex.right?.toFixed(1)}°</td>
                            <td>{p.angles.elbowAngle.left?.toFixed(1) ?? 'ー'}°</td>
                            <td>{p.angles.elbowAngle.right?.toFixed(1) ?? 'ー'}°</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 保存・エクスポート */}
              <div className="result-card">
                <h3 className="result-card-title">保存とエクスポート</h3>

                <div className="action-buttons">
                  <button
                    className="btn-action"
                    onClick={handleSaveSession}
                    disabled={saving}
                  >
                    💾 Supabaseに保存
                  </button>

                  <button
                    className="btn-action"
                    onClick={exportAnglesToCSV}
                    disabled={!poseResults.length}
                  >
                    📊 角度をCSV出力
                  </button>
                </div>

                {saveResult && (
                  <div className="save-result-msg">{saveResult}</div>
                )}
              </div>
            </div>

            <div className="wizard-actions">
              <button className="btn-ghost" onClick={() => setWizardStep(5)}>
                前へ
              </button>
              <button
                className="btn-primary-large"
                onClick={() => {
                  if (
                    window.confirm(
                      "最初からやり直しますか？現在のデータはリセットされます。"
                    )
                  ) {
                    // リセット処理
                    if (videoUrl) URL.revokeObjectURL(videoUrl);
                    setVideoUrl(null);
                    setVideoFile(null);
                    framesRef.current = [];
                    setFramesCount(0);
                    setCurrentFrame(0);
                    setExtractProgress(0);
                    setIsExtracting(false);
                    setUsedTargetFps(null);
                    setSectionStartFrame(null);
                    setSectionEndFrame(null);
                    setContactFrames([]);
                    setPoseResults([]);
                    setStatus("");
                    setWizardStep(1);
                    setDistanceInput("10");
                    setLabelInput("");
                    setNotesInput("");
                  }
                }}
              >
                最初からやり直す
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header-new">
        <h1 className="app-title-new">🏃‍♂️ Running Analysis Studio</h1>
        <p className="app-subtitle-new">
          フレーム抽出・姿勢推定・関節角度とステップ指標を一括解析
        </p>
      </header>

      {/* ステップインジケーター */}
      <div className="step-progress">
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <div
            key={step}
            className={
              wizardStep === step
                ? "step-item active"
                : wizardStep > step
                ? "step-item completed"
                : "step-item"
            }
          >
            <div className="step-circle">{step}</div>
            <div className="step-name">
              {step === 1 && "アップロード"}
              {step === 2 && "フレーム抽出"}
              {step === 3 && "姿勢推定"}
              {step === 4 && "区間設定"}
              {step === 5 && "マーカー"}
              {step === 6 && "結果"}
            </div>
          </div>
        ))}
      </div>

      {/* コンテンツエリア */}
      <main className="wizard-main">{renderStepContent()}</main>

      {/* 非表示のビデオ要素とキャンバス */}
      <div style={{ display: "none" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          preload="auto"
        />
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default App;
