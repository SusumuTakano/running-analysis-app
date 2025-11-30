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
  type SimpleStep,
  type ToeHeightData
} from "./SimpleStepDetection";
import { isMediaPipeAvailable, createSafePose, estimatePoseFallback, getFileType, validateFileSize } from "./SafeMediaPipe";

/** ウィザードのステップ */
type WizardStep = 0 | 1 | 3 | 3.5 | 4 | 5 | 5.5 | 6 | 7 | 8 | 9;

/** 測定者情報 */
type AthleteInfo = {
  name: string;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
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

/** メモリ効率のための軽量フレームデータ */
type LightFrameData = {
  frameNumber: number;
  timestamp: number;
  landmarks: Float32Array; // x, y, z, visibility を圧縮
};

/** つま先軌道データ */
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
    compressed[i * 4] = landmarks[i].x || 0;
    compressed[i * 4 + 1] = landmarks[i].y || 0;
    compressed[i * 4 + 2] = landmarks[i].z || 0;
    compressed[i * 4 + 3] = landmarks[i].visibility || 0;
  }
  return compressed;
};

/** 圧縮されたランドマークを展開 */
const decompressLandmarks = (compressed: Float32Array): Array<{ x: number; y: number; z: number; visibility: number }> => {
  const landmarks = [];
  for (let i = 0; i < compressed.length; i += 4) {
    landmarks.push({
      x: compressed[i],
      y: compressed[i + 1],
      z: compressed[i + 2],
      visibility: compressed[i + 3]
    });
  }
  return landmarks;
};

/** 高度なつま先軌道分析 - 改善版 */
const analyzeToeTrajectory = (frames: LightFrameData[]): ToeTrajectoryPoint[] => {
  const trajectory: ToeTrajectoryPoint[] = [];
  const windowSize = 3; // ウィンドウサイズを小さくして微細な動きを保持
  
  // 1. まず生の高さデータを収集
  const rawHeights: number[] = [];
  for (const frame of frames) {
    const landmarks = decompressLandmarks(frame.landmarks);
    const leftToe = landmarks[31]; // LEFT_FOOT_INDEX
    const rightToe = landmarks[32]; // RIGHT_FOOT_INDEX
    
    if (leftToe && rightToe && leftToe.visibility > 0.3 && rightToe.visibility > 0.3) {
      const height = Math.min(leftToe.y, rightToe.y);
      rawHeights.push(height);
    } else {
      rawHeights.push(NaN);
    }
  }
  
  // 2. 欠損値を補完
  const filledHeights = fillMissingValues(rawHeights);
  
  // 3. 軽度の平滑化（微細な動きを保持）
  const smoothedHeights = smoothArray(filledHeights, windowSize);
  
  // 4. 全体的な統計情報を計算（動的閾値用）
  const validHeights = smoothedHeights.filter(h => !isNaN(h));
  const avgHeight = validHeights.reduce((a, b) => a + b, 0) / validHeights.length;
  const heightRange = Math.max(...validHeights) - Math.min(...validHeights);
  
  // 5. 速度と変化を計算（適応的閾値）
  const descentThreshold = heightRange * 0.05; // 高さ変化の5%を閾値
  const velocityThreshold = descentThreshold * 0.8;
  
  for (let i = 1; i < smoothedHeights.length - 1; i++) {
    const current = smoothedHeights[i];
    const prev = smoothedHeights[i - 1];
    const next = smoothedHeights[i + 1];
    
    if (isNaN(current) || isNaN(prev) || isNaN(next)) {
      trajectory.push({
        frame: i,
        height: 0,
        velocity: 0,
        isDescending: false,
        isLowest: false,
        isRising: false
      });
      continue;
    }
    
    const velocity = current - prev;
    const isDescending = velocity > velocityThreshold;
    const isRising = velocity < -velocityThreshold;
    
    // 最低点検出を改善 - 速度がゼロ近くで、次が上昇
    const isNearZeroVelocity = Math.abs(velocity) < velocityThreshold * 0.5;
    const nextIsRising = (next - current) < -velocityThreshold * 0.3;
    const isLowest = isNearZeroVelocity && nextIsRising;
    
    trajectory.push({
      frame: i,
      height: current,
      velocity,
      isDescending,
      isLowest,
      isRising
    });
  }
  
  return trajectory;
};

/** 欠損値を補完 */
const fillMissingValues = (arr: number[]): number[] => {
  const result = [...arr];
  
  // 前方補完
  let lastValid = NaN;
  for (let i = 0; i < result.length; i++) {
    if (!isNaN(result[i])) {
      lastValid = result[i];
    } else if (!isNaN(lastValid)) {
      result[i] = lastValid;
    }
  }
  
  // 後方補完（前方補完で埋めきれなかった部分）
  let nextValid = NaN;
  for (let i = result.length - 1; i >= 0; i--) {
    if (!isNaN(result[i])) {
      nextValid = result[i];
    } else if (!isNaN(nextValid)) {
      result[i] = nextValid;
    }
  }
  
  return result;
};

/** 配列の平滑化 */
const smoothArray = (arr: number[], windowSize: number): number[] => {
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = -halfWindow; j <= halfWindow; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < arr.length && !isNaN(arr[idx])) {
        sum += arr[idx];
        count++;
      }
    }
    
    result.push(count > 0 ? sum / count : NaN);
  }
  
  return result;
};

/** 高度な接地/離地検出アルゴリズム - 改善版 */
const detectContactAndToeOffAdvanced = (
  frames: LightFrameData[],
  trajectory: ToeTrajectoryPoint[]
): { contactFrames: number[], toeOffFrames: number[] } => {
  const contactFrames: number[] = [];
  const toeOffFrames: number[] = [];
  
  // 1. つま先軌道からの検出（改善版）
  for (let i = 1; i < trajectory.length - 1; i++) {
    const current = trajectory[i];
    const prev = trajectory[i - 1];
    const next = trajectory[i + 1];
    
    // 下降→上昇の転換点（谷）を接地として検出
    if (prev && current.isLowest && !prev.isLowest) {
      contactFrames.push(current.frame);
    }
    
    // 上昇開始を離地として検出（より敏感に）
    if (prev && !prev.isRising && current.isRising) {
      toeOffFrames.push(current.frame);
    }
  }
  
  // 2. 関節角度からの補助的検出（感度を上げる）
  const jointBasedContacts = detectContactFromJoints(frames);
  const jointBasedToeOffs = detectToeOffFromJoints(frames);
  
  // 3. 2つの方法の結果を統合（より緩やかな統合）
  const finalContacts = mergeDetections(contactFrames, jointBasedContacts, 0.6);
  const finalToeOffs = mergeDetections(toeOffFrames, jointBasedToeOffs, 0.5);
  
  return {
    contactFrames: finalContacts,
    toeOffFrames: finalToeOffs
  };
};

/** 関節角度から接地を検出 */
const detectContactFromJoints = (frames: LightFrameData[]): number[] => {
  const contacts: number[] = [];
  
  for (let i = 0; i < frames.length; i++) {
    const landmarks = decompressLandmarks(frames[i].landmarks);
    
    // 膝の角度が急激に変化する点を検出
    if (i > 0) {
      const prevLandmarks = decompressLandmarks(frames[i - 1].landmarks);
      const kneeAngleChange = calculateKneeAngleChange(landmarks, prevLandmarks);
      
      if (kneeAngleChange > 15) { // 15度以上の変化
        contacts.push(i);
      }
    }
  }
  
  return contacts;
};

/** 関節角度から離地を検出 */
const detectToeOffFromJoints = (frames: LightFrameData[]): number[] => {
  const toeOffs: number[] = [];
  
  for (let i = 1; i < frames.length; i++) {
    const landmarks = decompressLandmarks(frames[i].landmarks);
    const prevLandmarks = decompressLandmarks(frames[i - 1].landmarks);
    
    // 足首の角度変化と位置変化を検出
    const anklePlantarflexion = detectAnklePlantarflexion(landmarks, prevLandmarks);
    
    if (anklePlantarflexion) {
      toeOffs.push(i);
    }
  }
  
  return toeOffs;
};

/** 膝角度変化を計算 */
const calculateKneeAngleChange = (current: any[], prev: any[]): number => {
  const getKneeAngle = (landmarks: any[], side: 'left' | 'right') => {
    const hip = landmarks[side === 'left' ? 23 : 24];
    const knee = landmarks[side === 'left' ? 25 : 26];
    const ankle = landmarks[side === 'left' ? 27 : 28];
    
    if (!hip || !knee || !ankle || hip.visibility < 0.5 || knee.visibility < 0.5 || ankle.visibility < 0.5) {
      return 0;
    }
    
    const v1 = { x: hip.x - knee.x, y: hip.y - knee.y };
    const v2 = { x: ankle.x - knee.x, y: ankle.y - knee.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const cosAngle = clamp(dot / (mag1 * mag2), -1, 1);
    return Math.acos(cosAngle) * 180 / Math.PI;
  };
  
  const currentLeft = getKneeAngle(current, 'left');
  const currentRight = getKneeAngle(current, 'right');
  const prevLeft = getKneeAngle(prev, 'left');
  const prevRight = getKneeAngle(prev, 'right');
  
  const leftChange = Math.abs(currentLeft - prevLeft);
  const rightChange = Math.abs(currentRight - prevRight);
  
  return Math.max(leftChange, rightChange);
};

/** 足首の底屈を検出 */
const detectAnklePlantarflexion = (current: any[], prev: any[]): boolean => {
  const getAnkleAngle = (landmarks: any[], side: 'left' | 'right') => {
    const knee = landmarks[side === 'left' ? 25 : 26];
    const ankle = landmarks[side === 'left' ? 27 : 28];
    const toe = landmarks[side === 'left' ? 31 : 32];
    
    if (!knee || !ankle || !toe || knee.visibility < 0.5 || ankle.visibility < 0.5 || toe.visibility < 0.5) {
      return 0;
    }
    
    const v1 = { x: knee.x - ankle.x, y: knee.y - ankle.y };
    const v2 = { x: toe.x - ankle.x, y: toe.y - ankle.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const cosAngle = clamp(dot / (mag1 * mag2), -1, 1);
    return Math.acos(cosAngle) * 180 / Math.PI;
  };
  
  const currentLeft = getAnkleAngle(current, 'left');
  const currentRight = getAnkleAngle(current, 'right');
  const prevLeft = getAnkleAngle(prev, 'left');
  const prevRight = getAnkleAngle(prev, 'right');
  
  // 足首の角度が増加（底屈）しているか
  const leftPlantarflexion = currentLeft > prevLeft + 5;
  const rightPlantarflexion = currentRight > prevRight + 5;
  
  return leftPlantarflexion || rightPlantarflexion;
};

/** 検出結果を統合 */
const mergeDetections = (method1: number[], method2: number[], threshold: number): number[] => {
  const merged: number[] = [];
  const used = new Set<number>();
  
  // 方法1の結果を優先的に追加
  for (const frame of method1) {
    if (!used.has(frame)) {
      merged.push(frame);
      used.add(frame);
    }
  }
  
  // 方法2の結果で、方法1と近い位置にあるものを追加
  for (const frame of method2) {
    let isNear = false;
    for (const existing of method1) {
      if (Math.abs(frame - existing) < 5) { // 5フレーム以内
        isNear = true;
        break;
      }
    }
    
    if (!isNear && !used.has(frame)) {
      merged.push(frame);
      used.add(frame);
    }
  }
  
  return merged.sort((a, b) => a - b);
};

/** 回転補正 */
const rotatePoint = (x: number, y: number, z: number, visibility: number, angle: number, centerX: number, centerY: number) => {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const dx = x - centerX;
  const dy = y - centerY;
  
  return {
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos,
    z,
    visibility
  };
};

/** メインコンポーネント */
const AppOptimized: React.FC<{ userProfile?: any }> = ({ userProfile }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [athleteInfo, setAthleteInfo] = useState<AthleteInfo>({
    name: "",
    age: null,
    gender: null,
    affiliation: "",
    height_cm: null,
    current_record: "",
    target_record: ""
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
  
  // 分析結果
  const [contactFrames, setContactFrames] = useState<number[]>([]);
  const [toeOffFrames, setToeOffFrames] = useState<number[]>([]);
  const [stepMetrics, setStepMetrics] = useState<StepMetric[]>([]);
  const [runningEvaluation, setRunningEvaluation] = useState<RunningEvaluation | null>(null);
  
  // 画面・デバイス対応
  const [isMobile, setIsMobile] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  
  // キャンバス参照
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // モバイル検出
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(mobile);
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // ステップ1: 動画ファイルの読み込み（メモリ効率化・高精度化）
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // ファイルサイズチェック（100MB制限）
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('ファイルサイズが大きすぎます。100MB以下のファイルを選択してください。');
      return;
    }
    
    // 画像ファイル（スクリーンショット）の処理を追加
    if (file.type.startsWith('image/')) {
      await handleImageUpload(file);
      return;
    }
    
    // 動画ファイルの種類チェック
    if (!file.type.startsWith('video/')) {
      setError('動画ファイルまたは画像ファイルを選択してください。');
      return;
    }
    
    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);
    
    // タイムアウト処理
    const timeoutId = setTimeout(() => {
      setError('処理がタイムアウトしました。ファイルサイズを小さくするか、別のファイルをお試しください。');
      setIsProcessing(false);
      setProcessingProgress(0);
    }, 120000); // 2分タイムアウト
    
    let video: HTMLVideoElement | null = null;
    
    try {
      // 動画の前処理：明るさ・コントラスト調整
      video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      
      await new Promise<void>((resolve) => {
        video!.onloadedmetadata = () => resolve();
      });
      
      const { videoWidth, videoHeight, duration } = video;
      const fps = 30; // 標準的なFPSを仮定
      const totalFrames = Math.floor(duration * fps);
      
      setVideoMetadata({ width: videoWidth, height: videoHeight, fps, totalFrames });
      
      // Canvasを使用してフレームを抽出（前処理付き）
      const canvas = document.createElement('canvas');
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      const frames: LightFrameData[] = [];
      const frameInterval = 1 / fps;
      
      // MediaPipe Poseの設定（簡素化版）
      const mp = (window as any).mp;
      if (!mp || !mp.tasks || !mp.tasks.vision) {
        throw new Error('MediaPipe が利用できません。ブラウザを更新するか、別のブラウザをお試しください。');
      }
      
      const poseConfig = getOptimizedPoseConfig();
      const pose = new mp.tasks.vision.Pose(poseConfig);
      
      for (let i = 0; i < totalFrames; i++) {
        const time = i * frameInterval;
        video.currentTime = time;
        
        await new Promise<void>((resolve) => {
          video!.onseeked = () => resolve();
        });
        
        // 簡素化された前処理
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
        
        // 画像の前処理：コントラスト調整（簡素化）
        preprocessForPoseEstimation(canvas);
        
        // 姿勢推定
        try {
          const result = await pose.detect(canvas);
          if (result.landmarks && result.landmarks.length > 0) {
            const compressed = compressLandmarks(result.landmarks[0]);
            frames.push({
              frameNumber: i,
              timestamp: time,
              landmarks: compressed
            });
          }
        } catch (e) {
          console.warn(`Frame ${i} processing failed:`, e);
        }
        
        // 進捗更新
        if (i % 10 === 0) {
          setProcessingProgress((i / totalFrames) * 50); // 50%まで
        }
      }
      
      setLightFrames(frames);
      
      // 簡素化されたつま先軌道分析
      const simpleTrajectory = analyzeSimpleToeTrajectory(frames);
      
      // ToeHeightDataをToeTrajectoryPointに変換
      const trajectory: ToeTrajectoryPoint[] = simpleTrajectory.map(point => ({
        frame: point.frame,
        height: point.height,
        velocity: point.velocity,
        isDescending: point.velocity > 0.1,
        isLowest: Math.abs(point.velocity) < 0.05,
        isRising: point.velocity < -0.1
      }));
      
      setToeTrajectory(trajectory);
      
      // 簡素化された接地・離地検出
      const steps = detectSimpleSteps(trajectory);
      
      // ステップデータをフレームデータに変換
      const contactFrames = steps.map(step => step.contactFrame);
      const toeOffFrames = steps.map(step => step.toeOffFrame);
      
      setContactFrames(contactFrames);
      setToeOffFrames(toeOffFrames);
      
      setProcessingProgress(100);
      setCurrentStep(3);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '動画処理中にエラーが発生しました');
    } finally {
      clearTimeout(timeoutId);
      setIsProcessing(false);
      setProcessingProgress(0);
      
      // メモリ解放
      if (video && video.src) URL.revokeObjectURL(video.src);
    }
  };
  
  // 画像（スクリーンショット）アップロード処理
  const handleImageUpload = async (file: File) => {
    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);
    
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });
      
      // Canvasに描画
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      ctx.drawImage(img, 0, 0);
      
      // MediaPipe Poseで姿勢推定（簡素化版）
      const mp = (window as any).mp;
      if (!mp || !mp.tasks || !mp.tasks.vision) {
        throw new Error('MediaPipe が利用できません。ブラウザを更新するか、別のブラウザをお試しください。');
      }
      
      const poseConfig = getOptimizedPoseConfig();
      const pose = new mp.tasks.vision.Pose(poseConfig);
      
      const result = await pose.detect(canvas);
      
      if (result.landmarks && result.landmarks.length > 0) {
        // 単一フレームとして処理
        const compressed = compressLandmarks(result.landmarks[0]);
        const frames: LightFrameData[] = [{
          frameNumber: 0,
          timestamp: 0,
          landmarks: compressed
        }];
        
        setLightFrames(frames);
        setVideoMetadata({ width: img.width, height: img.height, fps: 1, totalFrames: 1 });
        
        // 画像の場合は手動モードに切り替え
        setCurrentStep(3.5); // 手動マーカー配置モード
      } else {
        throw new Error('姿勢を検出できませんでした');
      }
      
      setProcessingProgress(100);
      
      // メモリ解放
      URL.revokeObjectURL(img.src);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };
  
  // レスポンシブなUIコンポーネント
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
              style={{ display: 'none' }}
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
        
        {/* その他のステップ... */}
      </div>
    );
  };
  
  const renderDesktopUI = () => {
    // デスクトップもモバイルUIを使用（レスポンシブ対応）
    return renderMobileUI();
  };
  
  return (
    <div className={`app-container ${isMobile ? 'mobile' : 'desktop'}`}>
      <div className="app-header">
        <h1>ランニングフォーム分析</h1>
        <div className="device-indicator">
          {isMobile ? (
            <><i className="fas fa-mobile-alt"></i> モバイルモード</>
          ) : (
            <><i className="fas fa-desktop"></i> デスクトップモード</>
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
        
        /* レスポンシブ対応：モバイルコンテナを全デバイスで表示 */
        .mobile-container {
          max-width: 600px;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
};

export default AppOptimized;