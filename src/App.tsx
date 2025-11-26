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
import { generateRunningEvaluation, type RunningEvaluation } from "./runningEvaluation";

/** ウィザードのステップ */
type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

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

type AppProps = {
  userProfile: {
    height_cm?: number | null;
    name: string;
    membership?: 'free' | 'pro' | null;
  } | null;
};

const App: React.FC<AppProps> = ({ userProfile }) => {
  // userProfile は AppWithAuth から渡される（認証済み）

  // デバイス判定（PC/モバイル/タブレット）
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const ua = navigator.userAgent;
      const width = window.innerWidth;
      
      // モバイル判定（iPhone, Android phone）
      const isMobileDevice = /iPhone|Android.*Mobile/i.test(ua) || width < 768;
      
      // タブレット判定（iPad, Android tablet）
      const isTabletDevice = /iPad|Android(?!.*Mobile)/i.test(ua) || (width >= 768 && width < 1024);
      
      setIsMobile(isMobileDevice && !isTabletDevice);
      setIsTablet(isTabletDevice);
      
      console.log(`📱 デバイス判定: ${isMobileDevice ? 'モバイル' : isTabletDevice ? 'タブレット' : 'PC'} (幅: ${width}px)`);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  
  // ------------ 測定者情報 -----------------
  const [athleteInfo, setAthleteInfo] = useState<AthleteInfo>({
    name: '',
    age: null,
    gender: null,
    affiliation: '',
    height_cm: null,
    current_record: '',
    target_record: '',
  });

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

  // チュートリアル
  const [showTutorial, setShowTutorial] = useState(true); // 初回表示フラグ
  const [tutorialStep, setTutorialStep] = useState(0); // 現在のステップ

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
  
  // 設定時の腰の位置を記憶（正規化座標 0-1）
  const [savedStartHipX, setSavedStartHipX] = useState<number | null>(null);
  const [savedMidHipX, setSavedMidHipX] = useState<number | null>(null);
  const [savedEndHipX, setSavedEndHipX] = useState<number | null>(null);

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
  
  // ------------ 100m目標記録 ---------------
  const [target100mInput, setTarget100mInput] = useState<string>("");
  const [targetAdvice, setTargetAdvice] = useState<string>("");

  const distanceValue = useMemo(() => {
    const d = parseFloat(distanceInput);
    return !isNaN(d) && d > 0 ? d : null;
  }, [distanceInput]);

  const avgSpeed =
    distanceValue != null && sectionTime != null && sectionTime > 0
      ? distanceValue / sectionTime
      : null;

  // ------------ 区間設定クリックモード ------------
  const [sectionClickMode, setSectionClickMode] = useState<'start' | 'mid' | 'end' | null>(null);

  // ------------ 接地／離地マーカー（キャリブレーション対応） ------------
  const [calibrationMode, setCalibrationMode] = useState<boolean>(true); // キャリブレーションモード
  const [toeOffThreshold, setToeOffThreshold] = useState<number | null>(null); // つま先上昇閾値（ピクセル）
  const [baseThreshold, setBaseThreshold] = useState<number | null>(null); // 元の閾値（調整用）
  const [manualContactFrames, setManualContactFrames] = useState<number[]>([]); // 接地フレーム（手動）
  const [autoToeOffFrames, setAutoToeOffFrames] = useState<number[]>([]); // 離地フレーム（自動判定）
  
  // 互換性のため、contactFrames を計算で生成（接地・離地を交互に並べる）
  const contactFrames = useMemo(() => {
    const result: number[] = [];
    for (let i = 0; i < manualContactFrames.length; i++) {
      result.push(manualContactFrames[i]);
      if (i < autoToeOffFrames.length) {
        result.push(autoToeOffFrames[i]);
      }
    }
    return result;
  }, [manualContactFrames, autoToeOffFrames]);

  const handleClearMarkers = () => {
    setManualContactFrames([]);
    setAutoToeOffFrames([]);
    setCalibrationMode(true);
    setToeOffThreshold(null);
    setBaseThreshold(null);
  };

  // つま先のY座標を取得（地面に近い方を基準）
  // 離地判定には、地面から離れる足（上昇する足）を検出する必要がある
  const getToeY = (poseData: FramePoseData | null): number | null => {
    if (!poseData || !poseData.landmarks) return null;
    const leftToe = poseData.landmarks[31]; // 左足つま先
    const rightToe = poseData.landmarks[32]; // 右足つま先
    if (!leftToe || !rightToe) return null;
    
    // 接地している足（Y座標が大きい=下にある）を基準にする
    // 離地するのは接地している足なので、より地面に近い方を追跡
    return Math.max(leftToe.y, rightToe.y);
  };
  
  // 足首のY座標も取得（補助的な判定）
  const getAnkleY = (poseData: FramePoseData | null): number | null => {
    if (!poseData || !poseData.landmarks) return null;
    const leftAnkle = poseData.landmarks[27]; // 左足首
    const rightAnkle = poseData.landmarks[28]; // 右足首
    if (!leftAnkle || !rightAnkle) return null;
    
    // 接地している足の足首を基準
    return Math.max(leftAnkle.y, rightAnkle.y);
  };

  // キャリブレーション：接地・離地の閾値を計算
  const handleCalibration = (contactFrame: number, toeOffFrame: number) => {
    const contactToeY = getToeY(poseResults[contactFrame]);
    const toeOffToeY = getToeY(poseResults[toeOffFrame]);
    
    if (contactToeY === null || toeOffToeY === null) {
      alert('つま先の検出に失敗しました。姿勢推定が完了しているか確認してください。');
      return false;
    }
    
    // Y座標の差分（離地時の方が小さい=上にある）
    const threshold = Math.abs(contactToeY - toeOffToeY);
    setToeOffThreshold(threshold);
    setBaseThreshold(threshold); // 元の閾値を保存
    setCalibrationMode(false);
    console.log(`✅ キャリブレーション完了: 閾値 = ${threshold.toFixed(4)}`);
    return true;
  };

  // 自動離地判定：接地後、つま先が閾値以上上昇したフレームを検出
  // 完全自動検出：全フレームから接地と離地を検出
  const autoDetectAllContactsAndToeOffs = () => {
    if (toeOffThreshold === null || baseThreshold === null) {
      console.warn('⚠️ キャリブレーションが完了していません');
      return;
    }
    if (!poseResults.length) return;
    if (!sectionStartFrame || !sectionEndFrame) {
      console.warn('⚠️ 区間が設定されていません');
      return;
    }

    console.log('🤖 完全自動検出を開始...');
    
    const detectedContacts: number[] = [];
    const detectedToeOffs: number[] = [];
    
    let currentFrame = sectionStartFrame;
    let searchStartFrame = currentFrame;
    
    // 区間内を順次検索
    while (searchStartFrame < sectionEndFrame) {
      // 次の接地を検出
      const contactFrame = detectNextContactFrame(searchStartFrame, sectionEndFrame);
      if (contactFrame === null) break;
      
      // 接地フレームを記録
      detectedContacts.push(contactFrame);
      
      // その接地に対応する離地を検出
      const toeOffFrame = detectToeOffFrame(contactFrame);
      if (toeOffFrame !== null) {
        detectedToeOffs.push(toeOffFrame);
        // 次の検索は離地フレームの少し後から
        searchStartFrame = toeOffFrame + 5;
      } else {
        // 離地が見つからない場合は、接地の少し後から検索
        searchStartFrame = contactFrame + 10;
      }
    }
    
    console.log(`✅ 自動検出完了: 接地 ${detectedContacts.length}回, 離地 ${detectedToeOffs.length}回`);
    
    // キャリブレーションの1歩目を含めて設定
    setManualContactFrames([manualContactFrames[0], ...detectedContacts]);
    setAutoToeOffFrames([autoToeOffFrames[0], ...detectedToeOffs]);
  };

  // 次の接地フレームを検出（つま先が停止している状態を検出）
  const detectNextContactFrame = (startFrame: number, endFrame: number): number | null => {
    if (!poseResults.length) return null;
    
    // 開始フレームから前方を検索
    for (let i = startFrame; i < endFrame - 10; i++) {
      const toeY = getToeY(poseResults[i]);
      if (toeY === null) continue;
      
      // 次の数フレームでつま先のY座標がほぼ変化しないか確認（接地判定）
      let isStable = true;
      let totalVariation = 0;
      
      for (let j = 1; j <= 5; j++) {
        if (i + j >= poseResults.length) break;
        const nextToeY = getToeY(poseResults[i + j]);
        if (nextToeY === null) {
          isStable = false;
          break;
        }
        
        // Y座標の変化量を計算（ピクセル単位）
        const variation = Math.abs(nextToeY - toeY);
        totalVariation += variation;
      }
      
      // 平均変化量が基準閾値の30%以下なら接地と判定
      const avgVariation = totalVariation / 5;
      if (isStable && baseThreshold !== null && avgVariation < baseThreshold * 0.3) {
        console.log(`🟢 接地検出: フレーム ${i} (平均変化: ${avgVariation.toFixed(4)})`);
        return i;
      }
    }
    
    return null;
  };

  const detectToeOffFrame = (contactFrame: number): number | null => {
    if (toeOffThreshold === null) return null;
    if (!poseResults.length) return null;
    
    const contactToeY = getToeY(poseResults[contactFrame]);
    const contactAnkleY = getAnkleY(poseResults[contactFrame]);
    if (contactToeY === null) return null;
    
    // 接地フレームから最大60フレーム先まで検索（2秒程度）
    const maxSearchFrames = 60;
    const endFrame = Math.min(contactFrame + maxSearchFrames, poseResults.length - 1);
    
    let maxRise = 0;
    let candidateFrame = null;
    
    // まず、つま先が上昇しているフレームを全て検出
    for (let i = contactFrame + 3; i <= endFrame; i++) {  // 最初の数フレームはスキップ（ノイズ除去）
      const currentToeY = getToeY(poseResults[i]);
      if (currentToeY === null) continue;
      
      // Y座標が小さくなる=上昇
      const rise = contactToeY - currentToeY;
      
      // 閾値の80%を超えたら候補として記録
      if (rise >= toeOffThreshold * 0.8) {
        // 足首も考慮（足首が上昇していることを確認）
        if (contactAnkleY !== null) {
          const currentAnkleY = getAnkleY(poseResults[i]);
          if (currentAnkleY !== null) {
            const ankleRise = contactAnkleY - currentAnkleY;
            // 足首も上昇している場合のみ有効
            if (ankleRise > 0) {
              if (rise > maxRise) {
                maxRise = rise;
                candidateFrame = i;
              }
            }
          }
        } else {
          // 足首データがない場合はつま先のみで判定
          if (rise > maxRise) {
            maxRise = rise;
            candidateFrame = i;
          }
        }
      }
      
      // 閾値を大きく超えたら、そこで確定（早期離脱）
      if (rise >= toeOffThreshold * 1.5) {
        console.log(`✅ 離地検出（早期確定）: フレーム ${i} (上昇量: ${rise.toFixed(4)})`);
        return i;
      }
    }
    
    // 候補が見つかった場合
    if (candidateFrame !== null) {
      console.log(`✅ 離地検出: フレーム ${candidateFrame} (最大上昇量: ${maxRise.toFixed(4)})`);
      return candidateFrame;
    }
    
    console.warn(`⚠️ 離地が検出できませんでした（接地: ${contactFrame}）`);
    return null; // 離地が見つからない
  };

  // キーボード操作
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!framesCount) return;

      if (e.code === "Space") {
        e.preventDefault();
        
        if (calibrationMode) {
          // キャリブレーションモード：接地と離地を手動マーク
          if (manualContactFrames.length === 0) {
            // 最初のマーク：接地
            setManualContactFrames([currentFrame]);
            console.log(`📍 キャリブレーション: 接地フレーム ${currentFrame}`);
          } else if (autoToeOffFrames.length === 0) {
            // 2番目のマーク：離地
            const contactFrame = manualContactFrames[0];
            if (currentFrame <= contactFrame) {
              alert('離地フレームは接地フレームより後にしてください。');
              return;
            }
            const success = handleCalibration(contactFrame, currentFrame);
            if (success) {
              setAutoToeOffFrames([currentFrame]);
              console.log(`📍 キャリブレーション: 離地フレーム ${currentFrame}`);
            }
          }
        } else {
          // 自動判定モード：接地のみ手動マーク、離地は自動
          const newContactFrames = [...manualContactFrames, currentFrame];
          setManualContactFrames(newContactFrames);
          console.log(`📍 接地マーク: フレーム ${currentFrame}`);
          
          // 離地を自動検出
          const toeOffFrame = detectToeOffFrame(currentFrame);
          if (toeOffFrame !== null) {
            setAutoToeOffFrames([...autoToeOffFrames, toeOffFrame]);
          } else {
            console.warn(`⚠️ 離地が検出できませんでした（接地: ${currentFrame}）`);
          }
        }
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

      // デバイスに応じた設定
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      pose.setOptions({
        modelComplexity: isMobile ? 0 : 1, // モバイルは軽量モデルを使用
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: isMobile ? 0.3 : 0.5, // モバイルは検出閾値を下げる
        minTrackingConfidence: isMobile ? 0.3 : 0.5,
      });
      
      console.log(`🎯 Pose estimation config: mobile=${isMobile}, iOS=${isIOS}, modelComplexity=${isMobile ? 0 : 1}`);

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
            // デバイスに応じたタイムアウト設定
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const timeoutDuration = isMobile ? 15000 : 5000; // モバイルは15秒、デスクトップは5秒
            
            const result = await new Promise<any>((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error("Timeout")),
                timeoutDuration
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
          } catch (e: any) {
            if (e.message === "Timeout") {
              console.warn(`⏱️ Frame ${i} timed out`);
            } else {
              console.error(`❌ Frame ${i} processing error:`, e.message);
            }
            results.push(null);
          }
        }
        
        // モバイルではメモリを解放するため、10フレームごとに少し待つ
        if (i % 10 === 0 && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
          await new Promise(resolve => setTimeout(resolve, 50));
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
      
      // 成功率を計算
      const successCount = results.filter(r => r !== null && r.landmarks).length;
      const successRateNum = successCount / results.length * 100;
      const successRateStr = successRateNum.toFixed(1);
      console.log(`📊 Pose estimation complete: ${successCount}/${results.length} frames (${successRateStr}%)`);
      
      if (successCount === 0) {
        setStatus("❌ 姿勢推定が完全に失敗しました。動画を変更してください。");
        alert("姿勢推定が失敗しました。\n\nより短い動画や、人物が大きく映っている動画をお試しください。");
        return;
      } else if (successRateNum < 50) {
        setStatus(`⚠️ 姿勢推定完了（成功率: ${successRateStr}%）- 精度が低い可能性があります`);
        if (!confirm(`姿勢推定の成功率が低いです（${successRateStr}%）。\n\n続行しますか？\n\n※ より短い動画や、人物が大きく映っている動画をお勧めします。`)) {
          return;
        }
      } else {
        setStatus(`✅ 姿勢推定完了！（成功率: ${successRateStr}%）`);
      }
      
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
    setSavedStartHipX(null);
    setSavedMidHipX(null);
    setSavedEndHipX(null);
    setManualContactFrames([]);
    setAutoToeOffFrames([]);
    setCalibrationMode(true);
    setToeOffThreshold(null);
    setBaseThreshold(null);
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

    // デバイス検出（モバイルかどうか）
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // 動画サイズとデバイスに応じた制限設定
    const videoSizeMB = (video.videoWidth * video.videoHeight * video.duration * 24) / (1024 * 1024);
    console.log(`📹 Video info: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration.toFixed(2)}s, estimated size: ${videoSizeMB.toFixed(1)}MB`);
    console.log(`📱 Device: ${isMobile ? 'Mobile' : 'Desktop'}, iOS: ${isIOS}`);

    const duration = video.duration;
    
    // デバイスに応じたメモリ制限
    let MAX_FRAMES: number;
    let MAX_WIDTH: number;
    let preferredFps: number;
    
    if (isIOS) {
      // iOS（iPhone/iPad）: 最も厳しい制限
      MAX_FRAMES = 400; // 通常の1000から大幅削減
      MAX_WIDTH = 480;  // 通常の960から半分に削減
      preferredFps = 60; // 通常の120から半分に削減
      console.log('⚠️ iOS detected: Using conservative memory limits');
    } else if (isMobile) {
      // その他のモバイル（Android等）
      MAX_FRAMES = 600;
      MAX_WIDTH = 640;
      preferredFps = 90;
      console.log('⚠️ Mobile detected: Using reduced memory limits');
    } else {
      // デスクトップ: 高性能対応
      MAX_FRAMES = 3000;  // 240fps × 12秒程度対応
      MAX_WIDTH = 1920;   // フルHD対応
      preferredFps = 240; // 240fps対応
      console.log('💻 Desktop detected: Using high-performance settings (240fps, 1920px)');
    }
    
    const maxFpsForLength = Math.floor(MAX_FRAMES / Math.max(duration, 0.001));
    const targetFps = Math.max(30, Math.min(preferredFps, maxFpsForLength));
    const dt = 1 / targetFps;
    const totalFrames = Math.max(1, Math.floor(duration * targetFps));

    setUsedTargetFps(targetFps);

    // 4K動画の検出と確認
    const is4K = video.videoWidth >= 3840 || video.videoHeight >= 2160;
    const isHighFps = targetFps >= 120;
    
    let scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    
    // 4K動画の場合は確認
    if (is4K && !isMobile) {
      const fullResMemoryMB = (video.videoWidth * video.videoHeight * totalFrames * 4) / (1024 * 1024);
      const scaledMemoryMB = (MAX_WIDTH * (video.videoHeight * MAX_WIDTH / video.videoWidth) * totalFrames * 4) / (1024 * 1024);
      
      console.log(`📹 4K video detected: ${video.videoWidth}x${video.videoHeight}`);
      console.log(`💾 Full resolution would use: ${fullResMemoryMB.toFixed(0)}MB`);
      console.log(`💾 Scaled to ${MAX_WIDTH}px would use: ${scaledMemoryMB.toFixed(0)}MB`);
      
      if (confirm(`4K動画が検出されました（${video.videoWidth}x${video.videoHeight}）\n\nフル解像度で処理しますか？\n\n「OK」: フル解像度（${fullResMemoryMB.toFixed(0)}MB使用、高精度）\n「キャンセル」: ${MAX_WIDTH}pxにスケール（${scaledMemoryMB.toFixed(0)}MB使用、推奨）`)) {
        scale = 1; // フル解像度
        console.log('✅ Processing at full 4K resolution');
      } else {
        console.log(`✅ Scaling to ${MAX_WIDTH}px for performance`);
      }
    }
    
    const targetWidth = Math.round(video.videoWidth * scale);
    const targetHeight = Math.round(video.videoHeight * scale);
    
    // メモリ使用量の推定と警告
    const estimatedMemoryMB = (targetWidth * targetHeight * totalFrames * 4) / (1024 * 1024);
    console.log(`💾 Estimated memory usage: ${estimatedMemoryMB.toFixed(1)}MB for ${totalFrames} frames at ${targetWidth}x${targetHeight}`);
    console.log(`📊 Video specs: ${targetFps}fps, ${totalFrames} frames, ${duration.toFixed(2)}s`);
    
    // 高FPS動画の警告
    if (isHighFps && estimatedMemoryMB > 500) {
      console.warn(`⚠️ High FPS video (${targetFps}fps) with large memory usage`);
      if (!confirm(`高フレームレート動画（${targetFps}fps）が検出されました。\nメモリ使用量: 約${estimatedMemoryMB.toFixed(0)}MB\n\n処理には時間がかかる場合があります。続行しますか？`)) {
        setIsExtracting(false);
        setStatus("キャンセルされました");
        return;
      }
    }
    
    if (isIOS && estimatedMemoryMB > 200) {
      console.warn('⚠️ High memory usage detected on iOS. May cause crash.');
      if (!confirm(`この動画の処理には約${estimatedMemoryMB.toFixed(0)}MBのメモリが必要です。\niPhoneでは処理中にクラッシュする可能性があります。\n\n続行しますか？`)) {
        setIsExtracting(false);
        setStatus("キャンセルされました");
        return;
      }
    }

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
          try {
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            framesRef.current.push(imageData);

            const progress = Math.round(((index + 1) / totalFrames) * 100);
            setExtractProgress(clamp(progress, 0, 99));
            setStatus(`フレーム抽出中... ${index + 1}/${totalFrames} フレーム`);

            index += 1;
            grabFrame();
          } catch (error) {
            // メモリエラーをキャッチしてクラッシュを防ぐ
            console.error('❌ Frame extraction error:', error);
            setIsExtracting(false);
            setStatus(`⚠️ フレーム抽出中にエラーが発生しました（${index}/${totalFrames}フレームまで処理）`);
            
            // エラーが発生しても、それまでに抽出したフレームは使用可能にする
            if (framesRef.current.length > 0) {
              setFramesCount(framesRef.current.length);
              setCurrentFrame(0);
              alert(`メモリ不足のため、${index}フレームまでで処理を中断しました。\n抽出済みの${framesRef.current.length}フレームは使用できます。\n\nより短い動画や低解像度の動画をお試しください。`);
            } else {
              alert('フレーム抽出中にエラーが発生しました。\nより短い動画や低解像度の動画をお試しください。');
              setWizardStep(1);
            }
          }
        });
      };

      const onSeekError = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onSeekError);
        console.error('❌ Video seek error at frame', index);
        
        // シークエラーの場合もクラッシュを防ぐ
        setIsExtracting(false);
        setStatus(`⚠️ 動画シークエラー（${index}/${totalFrames}フレーム）`);
        
        if (framesRef.current.length > 0) {
          setFramesCount(framesRef.current.length);
          setCurrentFrame(0);
          alert(`動画の読み込み中にエラーが発生しました。\n抽出済みの${framesRef.current.length}フレームは使用できます。`);
        } else {
          alert('動画の読み込み中にエラーが発生しました。\n別の動画ファイルをお試しください。');
          setWizardStep(1);
        }
      };

      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onSeekError);
      video.currentTime = clamp(currentTime, 0, duration);
    };

    grabFrame();
  };

  // ------------ 腰の位置を計算するヘルパー関数 ------------
  const calculateHipPosition = (frameIndex: number): number | null => {
    console.log(`🔍 calculateHipPosition called: frameIndex=${frameIndex}, poseResults.length=${poseResults.length}`);
    
    // poseResults全体のサマリーを表示（初回のみ）
    if (frameIndex >= 0) {
      let validCount = 0;
      let nullCount = 0;
      let noLandmarksCount = 0;
      
      for (let i = 0; i < Math.min(poseResults.length, 100); i++) {
        const p = poseResults[i];
        if (p === null || p === undefined) {
          nullCount++;
        } else if (!p.landmarks) {
          noLandmarksCount++;
        } else {
          validCount++;
        }
      }
      
      console.log(`📊 PoseResults summary (first 100 frames):`);
      console.log(`  - Valid poses with landmarks: ${validCount}`);
      console.log(`  - Null/undefined poses: ${nullCount}`);
      console.log(`  - Poses without landmarks: ${noLandmarksCount}`);
    }
    
    if (poseResults.length === 0 || frameIndex >= poseResults.length || frameIndex < 0) {
      console.log(`⚠️ calculateHipPosition: Invalid frame ${frameIndex} (poseResults.length=${poseResults.length})`);
      return null;
    }
    
    // まず指定されたフレームを試す
    const tryGetHipPosition = (idx: number): number | null => {
      if (idx < 0 || idx >= poseResults.length) return null;
      
      const pose = poseResults[idx];
      
      // デバッグ: poseオブジェクトの詳細を確認
      if (idx === frameIndex) {
        console.log(`🔍 Detailed check for frame ${idx}:`);
        console.log(`  - pose is null: ${pose === null}`);
        console.log(`  - pose is undefined: ${pose === undefined}`);
        console.log(`  - typeof pose: ${typeof pose}`);
        if (pose) {
          console.log(`  - pose has landmarks: ${'landmarks' in pose}`);
          console.log(`  - landmarks value:`, pose.landmarks);
          if (pose.landmarks) {
            console.log(`  - landmarks.length: ${pose.landmarks.length}`);
            console.log(`  - landmarks[23] (leftHip):`, pose.landmarks[23]);
            console.log(`  - landmarks[24] (rightHip):`, pose.landmarks[24]);
          }
        }
      }
      
      if (!pose?.landmarks) return null;
      
      const leftHip = pose.landmarks[23];
      const rightHip = pose.landmarks[24];
      
      if (!leftHip || !rightHip || leftHip.visibility < 0.5 || rightHip.visibility < 0.5) {
        if (idx === frameIndex) {
          console.log(`  - Hip visibility too low or missing: L=${leftHip?.visibility}, R=${rightHip?.visibility}`);
        }
        return null;
      }
      
      const hipCenterX = (leftHip.x + rightHip.x) / 2;
      return hipCenterX;
    };
    
    // 指定されたフレームで試す
    let hipX = tryGetHipPosition(frameIndex);
    if (hipX !== null) {
      console.log(`✅ calculateHipPosition: Frame ${frameIndex} → hipX=${(hipX * 100).toFixed(1)}%`);
      return hipX;
    }
    
    console.log(`⚠️ Frame ${frameIndex} has no valid hip data, searching nearby frames...`);
    
    // 前後±20フレームを探索（モバイルでは姿勢推定失敗が多いため範囲を拡大）
    const searchRange = 20;
    for (let offset = 1; offset <= searchRange; offset++) {
      // 前方を探索
      const prevIdx = frameIndex - offset;
      hipX = tryGetHipPosition(prevIdx);
      if (hipX !== null) {
        console.log(`✅ calculateHipPosition: Using frame ${prevIdx} (offset: ${-offset}) → hipX=${(hipX * 100).toFixed(1)}%`);
        return hipX;
      }
      
      // 後方を探索
      const nextIdx = frameIndex + offset;
      hipX = tryGetHipPosition(nextIdx);
      if (hipX !== null) {
        console.log(`✅ calculateHipPosition: Using frame ${nextIdx} (offset: +${offset}) → hipX=${(hipX * 100).toFixed(1)}%`);
        return hipX;
      }
    }
    
    console.log(`❌ calculateHipPosition: No valid hip data found within ±${searchRange} frames of ${frameIndex}`);
    return null;
  };

  // ------------ 区間マーカー線を描画 ------------
  // 接地/離地マーカーを描画（交互に色を変える）
  const drawContactMarkers = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentFrameNum: number
  ) => {
    // キャンバス上のマーカー描画は不要（コントロール下のエリアに表示）
    // 空の関数として残す
  };

  const drawSectionMarkers = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentFrameNum: number,
    viewParams?: { srcX: number; srcY: number; srcW: number; srcH: number; scale: number }
  ) => {
    const markers = [
      { frame: sectionStartFrame, color: "#10b981", label: "スタート", offset: startLineOffset, savedHipX: savedStartHipX },
      { frame: sectionMidFrame, color: "#f59e0b", label: "中間", offset: midLineOffset, savedHipX: savedMidHipX },
      { frame: sectionEndFrame, color: "#ef4444", label: "フィニッシュ", offset: endLineOffset, savedHipX: savedEndHipX },
    ];

    markers.forEach(({ frame, color, label, offset, savedHipX }) => {
      // フレームが設定されていない場合はスキップ
      if (frame == null) return;

      // 保存された腰の位置を使用（正規化座標 0-1）
      let torsoX: number;
      let fromPose = false;
      
      if (savedHipX !== null) {
        // 保存された位置を使用（常に設定時の腰の位置を表示）
        if (viewParams) {
          // 拡大表示時の座標変換
          const origX = savedHipX * width;
          const relX = origX - viewParams.srcX;
          torsoX = (relX / viewParams.srcW) * width;
        } else {
          // 通常表示
          torsoX = savedHipX * width;
        }
        fromPose = true;
        console.log(`📌 [${label}] Using saved hip position: ${(savedHipX * 100).toFixed(1)}% → ${torsoX.toFixed(0)}px`);
      } else {
        // 保存された位置がない場合はデフォルト（センター）
        torsoX = width / 2;
        console.log(`📍 [${label}] No saved position, using center: ${torsoX.toFixed(0)}px`);
      }
      
      // 手動オフセットを適用
      const finalX = torsoX + offset;
      console.log(`📐 [${label}] Frame ${frame}: Final position: ${finalX.toFixed(0)} (base=${torsoX.toFixed(0)} + offset=${offset})`);

      // 画面内に収まるように調整
      const clampedX = Math.max(20, Math.min(width - 20, finalX));

      // 垂直線を描画
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(clampedX, height);
      ctx.lineTo(clampedX, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // ラベルの背景
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 14px sans-serif";
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(clampedX - textWidth / 2 - 8, 12, textWidth + 16, 24);
      
      // ラベルを描画
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(label, clampedX, 28);
      
      // 姿勢推定からの位置かどうかのインジケーター
      if (!fromPose) {
        ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
        ctx.font = "10px sans-serif";
        ctx.fillText("手動", clampedX, 45);
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

    // Retina対応: デバイスピクセル比を考慮
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    if (!footZoomEnabled) {
      ctx.drawImage(offscreen, 0, 0, w, h, 0, 0, w, h);

      if (showSkeleton && poseResults[idx]?.landmarks) {
        drawSkeleton(ctx, poseResults[idx]!.landmarks, w, h);
      }
      
      // 区間マーカー線を描画
      drawSectionMarkers(ctx, w, h, currentFrame);
      
      // 接地/離地マーカーを描画
      drawContactMarkers(ctx, w, h, currentFrame);
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
      
      // 拡大表示時も接地/離地マーカーを描画
      drawContactMarkers(ctx, w, h, currentFrame);
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
    contactFrames,
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

  // ステップ7に移動したときにグラフを強制再描画
  useEffect(() => {
    if (wizardStep === 7 && stepMetrics.length > 0) {
      // グラフを再描画するために、少し遅延させる
      const timer = setTimeout(() => {
        const canvas = graphCanvasRef.current;
        if (canvas && chartInstanceRef.current) {
          chartInstanceRef.current.update();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [wizardStep, stepMetrics.length]);

  // AI評価機能
  const runningEvaluation: RunningEvaluation | null = useMemo(() => {
    return generateRunningEvaluation(stepMetrics, threePhaseAngles, {
      avgContact: stepSummary.avgContact ?? 0,
      avgFlight: stepSummary.avgFlight ?? 0,
      avgStepPitch: stepSummary.avgStepPitch ?? 0,
      avgStride: stepSummary.avgStride ?? 0,
      avgSpeed: stepSummary.avgSpeedMps ?? 0
    });
  }, [stepMetrics, threePhaseAngles, stepSummary]);

  // 研究データベース（目標記録に対する最適なピッチとストライド）
  // 出典: これまでの研究報告「身体の大きさ、四肢の長さがピッチに大きく影響し、体型によって至適ピッチが選択され、
  //        そのときのストライド長によってパフォーマンスが決まる」
  const getOptimalPitchStride = (targetTime: number, currentPitch: number, currentStride: number) => {
    const targetSpeed = 100 / targetTime;
    
    // 研究データ: 男子競技者の3つの体型パターン
    // ピッチ型: 4.66歩/秒、平均型: 4.84歩/秒、ストライド型: ~5.03歩/秒
    // 女子競技者: ピッチ型: 4.44歩/秒、平均型: 4.65歩/秒、ストライド型: 4.86歩/秒
    
    const matsuoData: { [key: string]: { pitch: number; stride: number }[] } = {
      "9.50": [{ pitch: 4.66, stride: 2.65 }, { pitch: 4.84, stride: 2.54 }, { pitch: 5.03, stride: 2.45 }],
      "9.60": [{ pitch: 4.66, stride: 2.62 }, { pitch: 4.84, stride: 2.52 }, { pitch: 5.03, stride: 2.42 }],
      "9.70": [{ pitch: 4.66, stride: 2.59 }, { pitch: 4.84, stride: 2.49 }, { pitch: 5.03, stride: 2.40 }],
      "9.80": [{ pitch: 4.66, stride: 2.56 }, { pitch: 4.84, stride: 2.46 }, { pitch: 5.03, stride: 2.37 }],
      "9.90": [{ pitch: 4.66, stride: 2.53 }, { pitch: 4.84, stride: 2.43 }, { pitch: 5.03, stride: 2.34 }],
      "10.00": [{ pitch: 4.66, stride: 2.50 }, { pitch: 4.84, stride: 2.40 }, { pitch: 5.03, stride: 2.32 }],
      "10.10": [{ pitch: 4.66, stride: 2.47 }, { pitch: 4.84, stride: 2.38 }, { pitch: 5.03, stride: 2.29 }],
      "10.20": [{ pitch: 4.66, stride: 2.44 }, { pitch: 4.84, stride: 2.35 }, { pitch: 5.03, stride: 2.26 }],
      "10.30": [{ pitch: 4.66, stride: 2.41 }, { pitch: 4.84, stride: 2.32 }, { pitch: 5.03, stride: 2.24 }],
      "10.50": [{ pitch: 4.44, stride: 2.36 }, { pitch: 4.65, stride: 2.26 }, { pitch: 4.86, stride: 2.18 }],
      "10.60": [{ pitch: 4.44, stride: 2.33 }, { pitch: 4.65, stride: 2.24 }, { pitch: 4.86, stride: 2.15 }],
      "10.80": [{ pitch: 4.44, stride: 2.27 }, { pitch: 4.65, stride: 2.18 }, { pitch: 4.86, stride: 2.10 }],
      "11.00": [{ pitch: 4.44, stride: 2.21 }, { pitch: 4.65, stride: 2.12 }, { pitch: 4.86, stride: 2.05 }],
      "11.20": [{ pitch: 4.44, stride: 2.15 }, { pitch: 4.65, stride: 2.07 }, { pitch: 4.86, stride: 1.99 }],
      "11.50": [{ pitch: 4.44, stride: 2.24 }, { pitch: 4.65, stride: 2.14 }, { pitch: 4.86, stride: 2.05 }],
      "12.00": [{ pitch: 4.44, stride: 1.92 }, { pitch: 4.65, stride: 1.84 }, { pitch: 4.86, stride: 1.78 }],
    };
    
    // 目標タイムに最も近いデータを取得
    const timeStr = targetTime.toFixed(2);
    let data = matsuoData[timeStr];
    
    if (!data) {
      // 補間または近似
      const times = Object.keys(matsuoData).map(t => parseFloat(t)).sort((a, b) => a - b);
      const closestTime = times.reduce((prev, curr) => 
        Math.abs(curr - targetTime) < Math.abs(prev - targetTime) ? curr : prev
      );
      data = matsuoData[closestTime.toFixed(2)];
    }
    
    // 現在のピッチ/ストライド比から体型を判定
    const pitchStrideRatio = currentPitch / currentStride;
    
    let selectedType = 1; // 平均型をデフォルト
    if (pitchStrideRatio > 2.4) {
      selectedType = 0; // ピッチ型
    } else if (pitchStrideRatio < 2.2) {
      selectedType = 2; // ストライド型
    }
    
    const optimal = data[selectedType];
    
    return {
      pitch: optimal.pitch,
      stride: optimal.stride,
      type: selectedType === 0 ? "ピッチ型" : selectedType === 2 ? "ストライド型" : "平均型"
    };
  };

  // 100m目標記録に基づく科学的アドバイス生成（研究データ使用）
  const generateTargetAdvice = (targetTime: number) => {
    if (!stepSummary.avgSpeedMps || !stepSummary.avgStride || !stepSummary.avgStepPitch) {
      return "現在の走行データが不足しています。マーカーを設定して解析を完了してください。";
    }

    const currentSpeed = stepSummary.avgSpeedMps;
    const currentStride = stepSummary.avgStride;
    const currentPitch = stepSummary.avgStepPitch;
    
    // 目標タイム（秒）から必要な平均速度を計算
    const targetSpeed = 100 / targetTime; // m/s
    const speedGap = targetSpeed - currentSpeed;
    const speedGapPercent = (speedGap / currentSpeed) * 100;

    // 研究データから最適なピッチとストライドを取得
    const optimal = getOptimalPitchStride(targetTime, currentPitch, currentStride);
    const optimalPitch = optimal.pitch;
    const optimalStride = optimal.stride;
    const bodyType = optimal.type;
    
    // 現在との差分を計算
    const strideGap = optimalStride - currentStride;
    const pitchGap = optimalPitch - currentPitch;
    
    // ストライドとピッチのバランスを評価
    const strideRatio = currentStride / optimalStride;
    const pitchRatio = currentPitch / optimalPitch;

    let advice = `## 🎯 100m ${targetTime}秒達成のためのアドバイス\n\n`;
    advice += `### 📊 現状分析\n`;
    advice += `- **現在の平均速度**: ${currentSpeed.toFixed(2)} m/s\n`;
    advice += `- **現在のピッチ**: ${currentPitch.toFixed(2)} 歩/秒\n`;
    advice += `- **現在のストライド**: ${currentStride.toFixed(2)} m\n`;
    advice += `- **判定された体型**: ${bodyType}\n\n`;
    
    advice += `### 🎯 目標値（これまでの研究報告に基づく）\n`;
    advice += `- **必要な平均速度**: ${targetSpeed.toFixed(2)} m/s\n`;
    advice += `- **最適なピッチ（${bodyType}）**: ${optimalPitch.toFixed(2)} 歩/秒\n`;
    advice += `- **最適なストライド（${bodyType}）**: ${optimalStride.toFixed(2)} m\n\n`;
    
    advice += `> 📚 **科学的根拠**: これまでの研究報告によると「身体の大きさ、四肢の長さがピッチに大きく影響し、体型によって至適ピッチが選択され、そのときのストライド長によってパフォーマンスが決まる」\n\n`;
    
    advice += `### 📈 改善が必要な項目\n`;
    advice += `- **速度**: ${speedGap >= 0 ? '+' : ''}${speedGap.toFixed(2)} m/s (${speedGapPercent >= 0 ? '+' : ''}${speedGapPercent.toFixed(1)}%)\n`;
    advice += `- **ピッチ**: ${pitchGap >= 0 ? '+' : ''}${pitchGap.toFixed(2)} 歩/秒 (現在は最適値の${(pitchRatio * 100).toFixed(1)}%)\n`;
    advice += `- **ストライド**: ${strideGap >= 0 ? '+' : ''}${strideGap.toFixed(2)} m (現在は最適値の${(strideRatio * 100).toFixed(1)}%)\n\n`;
    
    advice += `### 💡 体型別の特徴\n`;
    if (bodyType === "ピッチ型") {
      advice += `あなたは**ピッチ型**です。以下の特徴があります：\n`;
      advice += `- 高いピッチ（歩/秒）で走るタイプ\n`;
      advice += `- 接地時間が短く、素早い足の回転が得意\n`;
      advice += `- ストライドは相対的に短め\n`;
      advice += `- **強化ポイント**: 接地時間の短縮、爆発的な地面反力の向上\n\n`;
    } else if (bodyType === "ストライド型") {
      advice += `あなたは**ストライド型**です。以下の特徴があります：\n`;
      advice += `- 大きなストライド（歩幅）で走るタイプ\n`;
      advice += `- 股関節の可動域が広く、滞空時間が長い\n`;
      advice += `- ピッチは相対的に低め\n`;
      advice += `- **強化ポイント**: 股関節周辺の筋力強化、柔軟性向上\n\n`;
    } else {
      advice += `あなたは**平均型**です。以下の特徴があります：\n`;
      advice += `- ピッチとストライドのバランスが取れたタイプ\n`;
      advice += `- 両方の要素を均等に活用できる\n`;
      advice += `- 汎用性が高く、様々なトレーニングに対応可能\n`;
      advice += `- **強化ポイント**: ピッチとストライドの両方を段階的に向上\n\n`;
    }
    
    advice += `### 🔬 速度の方程式\n`;
    advice += `速度 = ピッチ × ストライド の関係式から、目標速度達成には以下の組み合わせが必要です：\n`;
    advice += `${targetSpeed.toFixed(2)} m/s = ${optimalPitch.toFixed(2)} 歩/秒 × ${optimalStride.toFixed(2)} m\n\n`;

    if (speedGap <= 0) {
      advice += `### ✅ 目標達成可能！\n`;
      advice += `現在の走力で100m ${targetTime}秒は十分に達成可能です！\n\n`;
      
      // スタートダッシュの基本技術（目標達成済みでも最適化のため）
      advice += `### 🏃 高野進氏のスプリント理論に基づくスタートダッシュ技術の最適化\n\n`;
      advice += `#### スタートダッシュ（1〜12歩）の洗練\n`;
      advice += `**飛び出し角度**: 42-45°を維持\n`;
      advice += `- ノア・ライルズ（9秒83）などトップスプリンターの科学的分析結果\n`;
      advice += `- 無理な前傾姿勢は推進力に繋がらない\n`;
      advice += `- **力のベクトルの変化**:\n`;
      advice += `  - 1〜3歩目: **後ろ方向＆下方向**への力発揮\n`;
      advice += `  - 4〜12歩: やや後ろ方向だが、ほぼ**下方向**へ移行\n`;
      advice += `  - 8〜12歩程度で初期加速が終わり、真下への踏み込み（鉛直成分）が強くなる\n\n`;
      advice += `**加速局面の技術**:\n`;
      advice += `- 膝の角度変化は少なく保つ\n`;
      advice += `- 膝の伸展動作よりも、**臀部を使った伸展動作**が重要\n`;
      advice += `- 膝を軽度屈曲位に維持したまま股関節伸展を行う\n`;
      advice += `- 接地時の膝角度を維持し、臀部の力を最大限に活用\n\n`;
      advice += `#### 最高速度域の技術\n`;
      advice += `**接地時間の短縮**: 目標 0.08-0.10秒\n`;
      advice += `- 真下への踏み込み（鉛直成分）を強化\n`;
      advice += `- 地面からの反発力を最大化\n`;
      advice += `**接地位置の最適化**:\n`;
      advice += `- 体の真下で接地\n`;
      advice += `- ブレーキング効果を最小限に\n`;
      advice += `- スムーズな重心移動\n\n`;
      advice += `---\n\n`;
      
      advice += `**維持・微調整すべきポイント**:\n`;
      advice += `1. **ピッチの微調整**: ${currentPitch.toFixed(2)} → ${optimalPitch.toFixed(2)}歩/秒\n`;
      advice += `   - メトロノームを使った一定リズムの練習\n`;
      advice += `   - 接地時間を短くする意識（0.08-0.10秒が理想）\n\n`;
      advice += `2. **ストライドの効率化**: ${currentStride.toFixed(2)} → ${optimalStride.toFixed(2)}m\n`;
      advice += `   - 無駄な動きを削減（上下動を最小限に）\n`;
      advice += `   - 接地位置を最適化（体の真下で接地）\n\n`;
      advice += `3. **レース戦略**\n`;
      advice += `   - スタート〜30m: 加速フェーズ（ピッチ重視、水平成分の力発揮）\n`;
      advice += `   - 30-60m: 最高速度維持（ピッチとストライドのバランス）\n`;
      advice += `   - 60-100m: 速度維持（リラックスして走る、真下への踏み込み）\n`;
    } else if (speedGapPercent < 5) {
      advice += `### 🔥 目標達成まであと少し！\n`;
      advice += `あと${speedGapPercent.toFixed(1)}%の速度向上で目標達成です！\n\n`;
      
      // スタートダッシュの基本技術（速度差5%未満）
      advice += `### 🏃 高野進氏のスプリント理論：スタートダッシュ技術の最適化\n\n`;
      advice += `#### スタートダッシュ（1〜12歩）の洗練\n`;
      advice += `**飛び出し角度**: 42-45°を維持\n`;
      advice += `- 1〜3歩目: **後ろ方向＆下方向**への力発揮\n`;
      advice += `- 4〜12歩: やや後ろ方向だが、ほぼ**下方向**へ移行\n`;
      advice += `- 接地時に水平成分を最大化（膝を上げすぎない）\n`;
      advice += `- 臀部を使った伸展動作（膝の伸展に頼らない）\n\n`;
      advice += `---\n\n`;
      
      // ピッチとストライドの改善優先度を科学的に判定
      const pitchDeficit = Math.abs(pitchGap);
      const strideDeficit = Math.abs(strideGap);
      
      if (pitchRatio < 0.9) {
        // ピッチが最適値の90%未満 → ピッチ優先
        advice += `### 🎯 優先改善項目: ピッチ向上\n`;
        advice += `現在のピッチ（${currentPitch.toFixed(2)}歩/秒）は最適値の${(pitchRatio * 100).toFixed(1)}%です。\n\n`;
        advice += `**ピッチ向上トレーニング** (目標: ${optimalPitch.toFixed(2)}歩/秒)\n`;
        advice += `1. **接地時間短縮ドリル**\n`;
        advice += `   - 目標接地時間: 0.08-0.10秒（現在より10-20%短縮）\n`;
        advice += `   - クイックステップドリル（20m × 3本）\n`;
        advice += `   - メトロノーム練習（目標ピッチに設定）\n`;
        advice += `   - **真下への踏み込み**を意識（鉛直成分の強化）\n\n`;
        advice += `2. **プライオメトリクス**\n`;
        advice += `   - アンクルホップ（足首の反発力強化）\n`;
        advice += `   - バウンディング（短距離・高頻度）\n`;
        advice += `   - ボックスジャンプ（爆発的な力発揮）\n`;
        advice += `   - 地面反力の最大化（体重の3-5倍の力を発揮）\n\n`;
        advice += `3. **技術練習**\n`;
        advice += `   - 腕振りの高速化（腕振り速度がピッチを決定）\n`;
        advice += `   - 下り坂ダッシュ（重力を利用したピッチ感覚）\n`;
        advice += `   - スタートダッシュ1〜12歩の水平成分重視\n`;
      } else if (strideRatio < 0.9) {
        // ストライドが最適値の90%未満 → ストライド優先
        advice += `### 🎯 優先改善項目: ストライド向上\n`;
        advice += `現在のストライド（${currentStride.toFixed(2)}m）は最適値の${(strideRatio * 100).toFixed(1)}%です。\n\n`;
        advice += `**ストライド向上トレーニング** (目標: ${optimalStride.toFixed(2)}m)\n`;
        advice += `1. **筋力強化**\n`;
        advice += `   - スクワット（体重の1.5-2倍の重量）\n`;
        advice += `   - ランジ（股関節の可動域と筋力）\n`;
        advice += `   - レッグカール（ハムストリングス強化）\n`;
        advice += `   - **臀部（グルート）の強化**: 股関節伸展の主要筋\n\n`;
        advice += `2. **柔軟性向上**\n`;
        advice += `   - 動的ストレッチ（練習前）\n`;
        advice += `   - 股関節の可動域を広げるドリル（目標: 70°以上）\n`;
        advice += `   - ハードルドリル（ストライド感覚）\n`;
        advice += `   - **膝を軽度屈曲位に維持**しながら股関節伸展を行う\n\n`;
        advice += `3. **技術練習**\n`;
        advice += `   - バウンディング（滞空時間を意識）\n`;
        advice += `   - 高膝走（膝を高く上げる意識）\n`;
        advice += `   - 接地位置の最適化（体の真下で接地）\n`;
        advice += `   - スタートダッシュで**臀部を使った伸展動作**を意識\n`;
      } else {
        // バランス型
        advice += `### 🎯 バランス型改善アプローチ\n`;
        advice += `ピッチ・ストライドともに最適値に近づいています。\n\n`;
        advice += `**統合トレーニング**\n`;
        advice += `1. **スピード持久力**\n`;
        advice += `   - 80m走 × 3-5本（95%の強度）\n`;
        advice += `   - 目標ピッチとストライドを意識\n`;
        advice += `   - 休息時間: 完全回復（5-8分）\n`;
        advice += `   - **接地位置の最適化**（体の真下で接地、ブレーキング効果の最小化）\n\n`;
        advice += `2. **レースペース走**\n`;
        advice += `   - 50-60m × 3本（目標速度で走る）\n`;
        advice += `   - ピッチ: ${optimalPitch.toFixed(2)}歩/秒を維持\n`;
        advice += `   - ストライド: ${optimalStride.toFixed(2)}mを維持\n`;
        advice += `   - 速度 = ${targetSpeed.toFixed(2)}m/s = ${optimalPitch.toFixed(2)}歩/秒 × ${optimalStride.toFixed(2)}m\n\n`;
        advice += `3. **技術統合**\n`;
        advice += `   - 加速走（30-60mで最高速度到達）\n`;
        advice += `   - 4〜12歩で水平成分から鉛直成分へ移行\n`;
        advice += `   - フライング走（助走をつけて最高速度を体験）\n`;
        advice += `   - 真下への踏み込み、地面反力の最大化\n`;
      }
    } else if (speedGapPercent < 10) {
      advice += `### 💪 目標達成には計画的なトレーニングが必要\n`;
      advice += `${speedGapPercent.toFixed(1)}%の速度向上が必要です。\n\n`;
      
      advice += `### 🏃 高野進氏のスプリント理論に基づく技術ポイント\n\n`;
      
      advice += `#### 1️⃣ スタートダッシュ（1〜12歩）のポイント\n`;
      advice += `**飛び出し角度**: 42-45°が最適\n`;
      advice += `- ノア・ライルズ（9秒83）などトップスプリンターの分析結果\n`;
      advice += `- 無理な前傾姿勢は推進力に繋がらない\n`;
      advice += `- 加速時は接地時に**水平成分**を生み出す（膝を上に引き上げない）\n`;
      advice += `- 滞空フェーズで加速成分は生み出せないので、浮きすぎないようにする\n\n`;
      
      advice += `**力のベクトルの変化**:\n`;
      advice += `- 1〜3歩目: **後ろ方向＆下方向**への力発揮\n`;
      advice += `- 4〜12歩: やや後ろ方向だが、ほぼ**下方向**へ移行\n`;
      advice += `- 8〜12歩程度で初期加速が終わり、真下への踏み込み（鉛直成分）が強くなる\n\n`;
      
      advice += `#### 2️⃣ 加速局面の技術\n`;
      advice += `**前傾姿勢の維持**:\n`;
      advice += `- 膝の角度変化は少なく保つ\n`;
      advice += `- 膝の伸展動作よりも、**臀部を使った伸展動作**が重要\n`;
      advice += `- 膝を軽度屈曲位に維持したまま股関節伸展を行う\n\n`;
      
      advice += `**挟み込み動作の優先**:\n`;
      advice += `- 1〜3歩目は特に水平方向への力発揮を意識\n`;
      advice += `- 接地時の膝角度を維持し、臀部の力を最大限に活用\n\n`;
      
      advice += `#### 3️⃣ 最高速度域の技術\n`;
      advice += `**接地時間の短縮**:\n`;
      advice += `- 目標: 0.08-0.10秒\n`;
      advice += `- 真下への踏み込み（鉛直成分）を強化\n`;
      advice += `- 地面からの反発力を最大化\n\n`;
      
      advice += `**接地位置の最適化**:\n`;
      advice += `- 体の真下で接地\n`;
      advice += `- ブレーキング効果を最小限に\n`;
      advice += `- スムーズな重心移動\n\n`;
      
      advice += `---\n\n`;
      
      advice += `### 📋 8週間トレーニングプラン\n\n`;
      
      advice += `**週1-2: 基礎フェーズ**\n`;
      advice += `目的: 筋力と神経系の適応\n`;
      advice += `- 筋力: スクワット 3セット×8回（80-85% 1RM）\n`;
      advice += `- 爆発力: ボックスジャンプ 3セット×5回\n`;
      advice += `- スピード: 30m加速走 5本（ピッチ意識）\n`;
      advice += `- 技術: ドリル（高膝走、もも上げ等）\n\n`;
      
      advice += `**週3-4: 強化フェーズ**\n`;
      advice += `目的: ピッチとストライドの統合\n`;
      advice += `- 筋力: クリーン 3セット×5回（爆発的動作）\n`;
      advice += `- ピッチ: クイックステップ 20m×5本（${optimalPitch.toFixed(1)}歩/秒目標）\n`;
      advice += `- ストライド: バウンディング 30m×4本\n`;
      advice += `- スピード: 50m走 4本（90%強度）\n\n`;
      
      advice += `**週5-6: 統合フェーズ**\n`;
      advice += `目的: レースペースでの走り込み\n`;
      advice += `- スピード持久力: 80m走 3本（95%強度）\n`;
      advice += `- レースペース: 60m走 4本（目標速度: ${targetSpeed.toFixed(2)}m/s）\n`;
      advice += `- 技術: フライング30m 4本（最高速度体験）\n\n`;
      
      advice += `**週7-8: ピーキングフェーズ**\n`;
      advice += `目的: コンディション調整と記録挑戦\n`;
      advice += `- 軽めのスピード: 40m走 3本（95%強度）\n`;
      advice += `- タイムトライアル: 100m全力走（週1回）\n`;
      advice += `- 回復: ストレッチと軽いジョギング\n\n`;
      
      advice += `### 🔬 重要な科学的ポイント\n`;
      advice += `1. **接地時間**: 0.08-0.10秒が理想（短いほどピッチが上がる）\n`;
      advice += `2. **地面反力**: 体重の3-5倍の力を発揮（筋力トレーニングで向上）\n`;
      advice += `3. **腕振り**: ピッチを決定する重要因子（肘角度90度を保つ）\n`;
      advice += `4. **体幹安定性**: 上下動を最小限にしてエネルギーロスを防ぐ\n`;
    } else {
      advice += `### 🏃 長期的なトレーニングで目標達成を目指しましょう\n`;
      advice += `${speedGapPercent.toFixed(1)}%の速度向上には、段階的なトレーニングが必要です。\n\n`;
      
      advice += `### 📋 16週間（4ヶ月）トレーニングプラン\n\n`;
      
      advice += `**フェーズ1（週1-4）: 基礎体力向上**\n`;
      advice += `目的: 筋力・柔軟性・持久力の基礎を構築\n`;
      advice += `- 筋力: 週3回（スクワット、デッドリフト、ランジ）\n`;
      advice += `  - 目標: 体重の1.5倍のスクワット達成\n`;
      advice += `- 柔軟性: 毎日20分（動的・静的ストレッチ）\n`;
      advice += `  - 股関節可動域を20%向上\n`;
      advice += `- 有酸素: 週2回（30分ジョギング）\n`;
      advice += `- スピード: 週1回（30m加速走×5本）\n\n`;
      
      advice += `**フェーズ2（週5-8）: スピード基礎強化**\n`;
      advice += `目的: ピッチとストライドの個別強化\n`;
      advice += `- ピッチ強化: 週2回\n`;
      advice += `  - クイックステップ 20m×6本（目標: ${(optimalPitch * 0.9).toFixed(2)}歩/秒）\n`;
      advice += `  - プライオメトリクス（アンクルホップ、バウンディング）\n`;
      advice += `- ストライド強化: 週2回\n`;
      advice += `  - バウンディング 40m×5本（目標: ${(optimalStride * 0.9).toFixed(2)}m）\n`;
      advice += `  - ハードルドリル\n`;
      advice += `- 筋力: 週2回（維持レベル）\n\n`;
      
      advice += `**フェーズ3（週9-12）: スピード統合**\n`;
      advice += `目的: ピッチとストライドを統合し、最高速度を向上\n`;
      advice += `- レースペース走: 週2回\n`;
      advice += `  - 60m走×4本（目標速度: ${(targetSpeed * 0.95).toFixed(2)}m/s）\n`;
      advice += `  - ピッチ ${optimalPitch.toFixed(2)}歩/秒、ストライド ${optimalStride.toFixed(2)}m を意識\n`;
      advice += `- スピード持久力: 週1回\n`;
      advice += `  - 80m走×3本（95%強度、完全回復）\n`;
      advice += `- 技術練習: 週1回\n`;
      advice += `  - フライング30m、下り坂ダッシュ\n\n`;
      
      advice += `**フェーズ4（週13-16）: ピーキングと記録挑戦**\n`;
      advice += `目的: 最高のコンディションで目標タイム達成\n`;
      advice += `- タイムトライアル: 週1回（100m全力走）\n`;
      advice += `- スピード維持: 週1回（40m走×3本、軽め）\n`;
      advice += `- 回復重視: ストレッチ、マッサージ\n`;
      advice += `- 記録会参加: 本番環境でのレース経験\n\n`;
      
      advice += `### 🔬 科学的根拠とトレーニング原理\n\n`;
      advice += `**1. 速度 = ピッチ × ストライド の関係**\n`;
      advice += `- 目標: ${targetSpeed.toFixed(2)}m/s = ${optimalPitch.toFixed(2)}歩/秒 × ${optimalStride.toFixed(2)}m\n`;
      advice += `- 両方を10%向上させると、速度は約21%向上\n`;
      advice += `- バランスの取れた改善が最も効果的\n\n`;
      
      advice += `**2. 接地時間と地面反力**\n`;
      advice += `- トップスプリンター: 接地時間 0.08-0.10秒\n`;
      advice += `- 地面反力: 体重の3-5倍\n`;
      advice += `- プライオメトリクスで向上可能\n\n`;
      
      advice += `**3. 筋力と加速力の関係**\n`;
      advice += `- スクワット1RMが体重の2倍: 優れたスプリント能力\n`;
      advice += `- 爆発的筋力（RFD）が最高速度を決定\n`;
      advice += `- クリーン、スナッチで向上\n\n`;
      
      advice += `**4. エネルギーシステム**\n`;
      advice += `- 100m走: 主にATP-PC系（無酸素的解糖）\n`;
      advice += `- 休息時間: 完全回復（5-8分）が必要\n`;
      advice += `- 質の高い練習が量よりも重要\n`;
    }

    // 姿勢に関するアドバイス
    if (runningEvaluation) {
      advice += `\n### 🎯 フォーム改善ポイント\n`;
      advice += runningEvaluation.overallMessage + '\n\n';
      
      if (runningEvaluation.evaluations.length > 0) {
        advice += `**具体的な改善提案**:\n`;
        runningEvaluation.evaluations.forEach((evaluation, i) => {
          advice += `${i + 1}. **${evaluation.category}**: ${evaluation.advice}\n`;
        });
      }
    }

    return advice;
  };

  // 認証は AppWithAuth で処理済み

  // ステップ変更時にフレームを10に設定
  useEffect(() => {
    if (wizardStep === 4 || wizardStep === 5) {
      if (ready && framesCount > 10) {
        setCurrentFrame(10);
      }
    }
  }, [wizardStep, ready, framesCount]);

  // 認証ハンドラー
  // 認証は AppWithAuth で処理済み

  // ------------ ウィザードステップの内容 ------------
  const renderStepContent = () => {
    switch (wizardStep) {
      case 0:
        return (
          <div className="wizard-content">
            <div className="wizard-step-header">
              <h2 className="wizard-step-title">ステップ 0: 測定者情報</h2>
              <p className="wizard-step-desc">
                測定者の基本情報を入力してください。身長や目標記録は解析に活用されます。
              </p>
            </div>

            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              background: 'white',
              padding: '32px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 氏名 */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                    氏名 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={athleteInfo.name}
                    onChange={(e) => setAthleteInfo({ ...athleteInfo, name: e.target.value })}
                    placeholder="山田 太郎"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* 年齢と性別 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                      年齢 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      value={athleteInfo.age ?? ''}
                      onChange={(e) => setAthleteInfo({ ...athleteInfo, age: e.target.value ? Number(e.target.value) : null })}
                      placeholder="25"
                      min="1"
                      max="120"
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                      性別 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={athleteInfo.gender ?? ''}
                      onChange={(e) => setAthleteInfo({ ...athleteInfo, gender: e.target.value as 'male' | 'female' | 'other' | null })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        outline: 'none'
                      }}
                    >
                      <option value="">選択してください</option>
                      <option value="male">男性</option>
                      <option value="female">女性</option>
                      <option value="other">その他</option>
                    </select>
                  </div>
                </div>

                {/* 所属 */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                    所属（任意）
                  </label>
                  <input
                    type="text"
                    value={athleteInfo.affiliation}
                    onChange={(e) => setAthleteInfo({ ...athleteInfo, affiliation: e.target.value })}
                    placeholder="〇〇高校陸上部"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* 身長 */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                    身長（cm） <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={athleteInfo.height_cm ?? ''}
                    onChange={(e) => setAthleteInfo({ ...athleteInfo, height_cm: e.target.value ? Number(e.target.value) : null })}
                    placeholder="170"
                    min="100"
                    max="250"
                    step="0.1"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                  />
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>
                    ※ ストライド比の計算に使用されます
                  </p>
                </div>

                {/* 現在の記録と目標記録 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                      現在の記録（任意）
                    </label>
                    <input
                      type="text"
                      value={athleteInfo.current_record}
                      onChange={(e) => setAthleteInfo({ ...athleteInfo, current_record: e.target.value })}
                      placeholder="12.50秒"
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                      目標記録（任意）
                    </label>
                    <input
                      type="text"
                      value={athleteInfo.target_record}
                      onChange={(e) => setAthleteInfo({ ...athleteInfo, target_record: e.target.value })}
                      placeholder="12.00秒"
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        outline: 'none'
                      }}
                    />
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>
                      ※ AIアドバイスに使用されます
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="wizard-nav">
              <div></div>
              <button
                className="btn-primary-large"
                onClick={() => setWizardStep(1)}
                disabled={!athleteInfo.name || !athleteInfo.age || !athleteInfo.gender || !athleteInfo.height_cm}
              >
                次へ：動画アップロード
              </button>
            </div>
          </div>
        );

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

            <div className="wizard-nav">
              <button className="btn-ghost" onClick={() => setWizardStep(0)}>
                前へ：測定者情報
              </button>
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

            <div className="canvas-area" style={{ position: 'relative' }}>
              <canvas 
                ref={displayCanvasRef} 
                className="preview-canvas" 
                onClick={(e) => {
                  if (!ready || !sectionClickMode) return;
                  
                  // キャンバス上のクリック位置からフレームを特定
                  const canvas = displayCanvasRef.current;
                  if (!canvas) return;
                  
                  const rect = canvas.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const canvasWidth = rect.width;
                  
                  // クリック位置の割合からフレーム番号を計算
                  const clickRatio = clickX / canvasWidth;
                  let targetFrame = Math.round(clickRatio * (framesCount - 1));
                  targetFrame = Math.max(0, Math.min(framesCount - 1, targetFrame));
                  
                  // 最も近い有効なフレームを探す（腰の位置が取得できるフレーム）
                  let bestFrame = targetFrame;
                  let bestDistance = Infinity;
                  
                  // ターゲットフレーム周辺±30フレームを探索
                  for (let offset = 0; offset <= 30; offset++) {
                    for (const testFrame of [targetFrame + offset, targetFrame - offset]) {
                      if (testFrame < 0 || testFrame >= framesCount) continue;
                      
                      const hipX = calculateHipPosition(testFrame);
                      if (hipX !== null) {
                        const distance = Math.abs(testFrame - targetFrame);
                        if (distance < bestDistance) {
                          bestDistance = distance;
                          bestFrame = testFrame;
                        }
                        break;
                      }
                    }
                    if (bestDistance < Infinity) break;
                  }
                  
                  // フレームを設定してジャンプ
                  const hipX = calculateHipPosition(bestFrame);
                  
                  if (sectionClickMode === 'start') {
                    setSectionStartFrame(bestFrame);
                    setStartLineOffset(0);
                    setSavedStartHipX(hipX);
                    setCurrentFrame(bestFrame);
                    console.log(`🟢 スタート設定: Frame ${bestFrame} (クリック位置から自動検出)`);
                    setSectionClickMode(null);
                  } else if (sectionClickMode === 'mid') {
                    setSectionMidFrame(bestFrame);
                    setMidLineOffset(0);
                    setSavedMidHipX(hipX);
                    setCurrentFrame(bestFrame);
                    console.log(`🟡 中間設定: Frame ${bestFrame} (クリック位置から自動検出)`);
                    setSectionClickMode(null);
                  } else if (sectionClickMode === 'end') {
                    setSectionEndFrame(bestFrame);
                    setEndLineOffset(0);
                    setSavedEndHipX(hipX);
                    setCurrentFrame(bestFrame);
                    console.log(`🔴 フィニッシュ設定: Frame ${bestFrame} (クリック位置から自動検出)`);
                    setSectionClickMode(null);
                  }
                }}
                style={{
                  cursor: sectionClickMode ? 'crosshair' : 'default'
                }}
              />
              {sectionClickMode && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(59, 130, 246, 0.95)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}>
                  {sectionClickMode === 'start' && '🟢 スタート地点をクリック（位置から自動検出）'}
                  {sectionClickMode === 'mid' && '🟡 中間地点をクリック（位置から自動検出）'}
                  {sectionClickMode === 'end' && '🔴 フィニッシュ地点をクリック（位置から自動検出）'}
                </div>
              )}
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
                  🖱️ 「クリックで設定」ボタンを押してから、キャンバス上の目的の位置を直接クリックしてください。<br/>
                  ⚡ クリック位置から自動的に最適なフレームが検出・設定されます。<br/>
                  📍 設定後、±ボタンでフレーム単位の微調整ができます。
                </p>
              </div>

              <div className="section-item">
                <div className="section-label">
                  <div className="marker-badge start">スタート</div>
                  <strong>フレーム:</strong>{" "}
                  {sectionStartFrame ?? "未設定"}
                </div>
                <button
                  className={sectionClickMode === 'start' ? "btn-primary" : "btn-secondary"}
                  onClick={() => {
                    setSectionClickMode(sectionClickMode === 'start' ? null : 'start');
                  }}
                  disabled={!ready}
                  style={{ width: '100%' }}
                >
                  {sectionClickMode === 'start' ? '✖️ キャンセル' : '🖱️ クリックで設定'}
                </button>
              </div>
              {sectionStartFrame != null && (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    marginTop: '8px'
                  }}>
                    <span style={{ fontSize: '0.9rem', color: '#6b7280', minWidth: '100px' }}>フレーム微調整:</span>
                    <button
                      onClick={() => {
                        const newFrame = Math.max(0, sectionStartFrame - 5);
                        setSectionStartFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedStartHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      -5
                    </button>
                    <button
                      onClick={() => {
                        const newFrame = Math.max(0, sectionStartFrame - 1);
                        setSectionStartFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedStartHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      -1
                    </button>
                    <button
                      onClick={() => {
                        const newFrame = Math.min(framesCount - 1, sectionStartFrame + 1);
                        setSectionStartFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedStartHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      +1
                    </button>
                    <button
                      onClick={() => {
                        const newFrame = Math.min(framesCount - 1, sectionStartFrame + 5);
                        setSectionStartFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedStartHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      +5
                    </button>
                    <button
                      onClick={() => setCurrentFrame(sectionStartFrame)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #3b82f6',
                        background: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        marginLeft: '8px'
                      }}
                    >
                      ジャンプ
                    </button>
                  </div>
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
                </>
              )}

              <div className="section-item">
                <div className="section-label">
                  <div className="marker-badge mid">中間（任意）</div>
                  <strong>フレーム:</strong>{" "}
                  {sectionMidFrame ?? "未設定"}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={sectionClickMode === 'mid' ? "btn-primary" : "btn-secondary"}
                    onClick={() => {
                      setSectionClickMode(sectionClickMode === 'mid' ? null : 'mid');
                    }}
                    disabled={!ready}
                    style={{ flex: 1 }}
                  >
                    {sectionClickMode === 'mid' ? '✖️ キャンセル' : '🖱️ クリックで設定'}
                  </button>
                  {sectionMidFrame != null && (
                    <button
                      className="btn-ghost-small"
                      onClick={() => {
                        setSectionMidFrame(null);
                        setMidLineOffset(0);
                        setSavedMidHipX(null);
                      }}
                    >
                      クリア
                    </button>
                  )}
                </div>
              </div>
              {sectionMidFrame != null && (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    marginTop: '8px'
                  }}>
                    <span style={{ fontSize: '0.9rem', color: '#6b7280', minWidth: '100px' }}>フレーム微調整:</span>
                    <button
                      onClick={() => {
                        const newFrame = Math.max(0, sectionMidFrame - 5);
                        setSectionMidFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedMidHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      -5
                    </button>
                    <button
                      onClick={() => {
                        const newFrame = Math.max(0, sectionMidFrame - 1);
                        setSectionMidFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedMidHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      -1
                    </button>
                    <button
                      onClick={() => {
                        const newFrame = Math.min(framesCount - 1, sectionMidFrame + 1);
                        setSectionMidFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedMidHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      +1
                    </button>
                    <button
                      onClick={() => {
                        const newFrame = Math.min(framesCount - 1, sectionMidFrame + 5);
                        setSectionMidFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedMidHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      +5
                    </button>
                    <button
                      onClick={() => setCurrentFrame(sectionMidFrame)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #3b82f6',
                        background: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        marginLeft: '8px'
                      }}
                    >
                      ジャンプ
                    </button>
                  </div>
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
                </>
              )}

              <div className="section-item">
                <div className="section-label">
                  <div className="marker-badge end">フィニッシュ</div>
                  <strong>フレーム:</strong>{" "}
                  {sectionEndFrame ?? "未設定"}
                </div>
                <button
                  className={sectionClickMode === 'end' ? "btn-primary" : "btn-secondary"}
                  onClick={() => {
                    setSectionClickMode(sectionClickMode === 'end' ? null : 'end');
                  }}
                  disabled={!ready}
                  style={{ width: '100%' }}
                >
                  {sectionClickMode === 'end' ? '✖️ キャンセル' : '🖱️ クリックで設定'}
                </button>
              </div>
              {sectionEndFrame != null && (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    marginTop: '8px'
                  }}>
                    <span style={{ fontSize: '0.9rem', color: '#6b7280', minWidth: '100px' }}>フレーム微調整:</span>
                    <button
                      onClick={() => {
                        const newFrame = Math.max(0, sectionEndFrame - 5);
                        setSectionEndFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedEndHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      -5
                    </button>
                    <button
                      onClick={() => {
                        const newFrame = Math.max(0, sectionEndFrame - 1);
                        setSectionEndFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedEndHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      -1
                    </button>
                    <button
                      onClick={() => {
                        const newFrame = Math.min(framesCount - 1, sectionEndFrame + 1);
                        setSectionEndFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedEndHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      +1
                    </button>
                    <button
                      onClick={() => {
                        const newFrame = Math.min(framesCount - 1, sectionEndFrame + 5);
                        setSectionEndFrame(newFrame);
                        const hipX = calculateHipPosition(newFrame);
                        setSavedEndHipX(hipX);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      +5
                    </button>
                    <button
                      onClick={() => setCurrentFrame(sectionEndFrame)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid #3b82f6',
                        background: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        marginLeft: '8px'
                      }}
                    >
                      ジャンプ
                    </button>
                  </div>
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
                </>
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
              
              {/* キャリブレーションモードの説明 */}
              {calibrationMode ? (
                <div style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  marginTop: '16px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📍</span>
                    <span>キャリブレーション（最初の1歩のみ）</span>
                  </div>
                  <div style={{ fontSize: '0.95rem', lineHeight: '1.8', marginBottom: '16px' }}>
                    最初の1歩のみ、<strong>接地</strong>と<strong>離地</strong>の両方のフレームをマークしてください。<br />
                    これにより、離地を自動検出するための閾値が計算されます。
                  </div>
                  <div style={{
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '0.9rem',
                    lineHeight: '1.6'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>📝 手順：</div>
                    <ol style={{ margin: 0, paddingLeft: '20px' }}>
                      <li>足が<strong>地面に接地</strong>したフレームで「🟢 接地をマーク」</li>
                      <li>足が<strong>地面から離れた</strong>フレームで「🔴 離地をマーク」</li>
                      <li>キャリブレーション完了後、2歩目以降は接地のみマーク</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  marginTop: '16px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>✅</span>
                    <span>自動検出モード</span>
                  </div>
                  <div style={{ fontSize: '0.95rem', lineHeight: '1.8' }}>
                    2歩目以降は、<strong>接地のみ</strong>マークしてください。<br />
                    離地は自動的に検出されます。
                  </div>
                </div>
              )}
              
              {/* キャリブレーション状態表示 */}
              {!calibrationMode && toeOffThreshold !== null && (
                <div style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  margin: '8px 0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '12px' }}>
                    ✅ キャリブレーション完了（閾値: {(toeOffThreshold * 100).toFixed(1)}%）
                  </div>
                  
                  {/* 完全自動検出ボタン */}
                  <div style={{ marginBottom: '12px' }}>
                    <button
                      onClick={() => {
                        if (window.confirm('区間内のすべての接地と離地を自動検出しますか？\n（現在のマーカーは保持されます）')) {
                          autoDetectAllContactsAndToeOffs();
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        background: 'rgba(255, 255, 255, 0.95)',
                        color: '#059669',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>🤖</span>
                      <span>すべて自動検出</span>
                    </button>
                    <p style={{ 
                      fontSize: '0.75rem', 
                      marginTop: '8px', 
                      opacity: 0.9,
                      textAlign: 'center'
                    }}>
                      キャリブレーションの閾値を使って、区間内のすべての接地・離地を自動で検出します
                    </p>
                  </div>
                  
                  {/* 閾値調整スライダー */}
                  <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '6px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px' }}>
                      🎚️ 閾値の微調整（離地判定の感度）
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>低</span>
                      <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        value={baseThreshold ? toeOffThreshold! / baseThreshold : 1.0}
                        onChange={(e) => {
                          const ratio = parseFloat(e.target.value);
                          if (baseThreshold) {
                            setToeOffThreshold(baseThreshold * ratio);
                            console.log(`🎚️ 閾値調整: ${(baseThreshold * ratio).toFixed(4)} (比率: ${ratio.toFixed(1)}x)`);
                          }
                        }}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>高</span>
                      <button
                        onClick={() => {
                          if (baseThreshold) {
                            setToeOffThreshold(baseThreshold);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          background: 'rgba(255,255,255,0.3)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        リセット
                      </button>
                    </div>
                    <div style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '4px', opacity: 0.9 }}>
                      ※ 離地が<strong>遅すぎる</strong>場合は<strong>低く</strong>、<strong>早すぎる</strong>場合は<strong>高く</strong>調整
                    </div>
                  </div>
                </div>
              )}
              
              {calibrationMode && manualContactFrames.length === 0 && (
                <div style={{
                  background: '#fbbf24',
                  color: '#78350f',
                  padding: '12px',
                  borderRadius: '8px',
                  margin: '8px 0',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}>
                  📍 ステップ1: 接地フレームをマークしてください
                </div>
              )}
              
              {calibrationMode && manualContactFrames.length === 1 && autoToeOffFrames.length === 0 && (
                <div style={{
                  background: '#fbbf24',
                  color: '#78350f',
                  padding: '12px',
                  borderRadius: '8px',
                  margin: '8px 0',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}>
                  📍 ステップ2: 離地フレームをマークしてください
                </div>
              )}
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
              {!calibrationMode && (
                <button 
                  className="btn-ghost-small" 
                  onClick={handleClearMarkers}
                  style={{ background: '#fbbf24', color: '#78350f' }}
                >
                  🔄 キャリブレーションやり直し
                </button>
              )}
              <button className="btn-ghost-small" onClick={handleClearMarkers}>
                マーカークリア
              </button>
            </div>

            <div className="canvas-area">
              <canvas ref={displayCanvasRef} className="preview-canvas" />
            </div>

            {/* モバイル用：フレーム移動ボタン */}
            {isMobile && (
            <div className="mobile-marking-controls">
              <div className="mobile-frame-nav">
                <button 
                  className="btn-nav-arrow" 
                  onClick={() => changeFrame(-10)} 
                  disabled={!ready}
                >
                  ◀◀ -10
                </button>
                <button 
                  className="btn-nav-arrow" 
                  onClick={() => changeFrame(-1)} 
                  disabled={!ready}
                >
                  ◀ -1
                </button>
                <button 
                  className="btn-nav-arrow" 
                  onClick={() => changeFrame(1)} 
                  disabled={!ready}
                >
                  +1 ▶
                </button>
                <button 
                  className="btn-nav-arrow" 
                  onClick={() => changeFrame(10)} 
                  disabled={!ready}
                >
                  +10 ▶▶
                </button>
              </div>
            </div>
            )}

            {/* マーカー表示エリア - コントロールの下に配置 */}
            {isMobile && (
            <div className="mobile-marker-display">
              {contactFrames.map((markerFrame, index) => {
                if (markerFrame === currentFrame) {
                  const isContact = index % 2 === 0;
                  const color = isContact ? "#10b981" : "#ef4444";
                  const label = isContact ? "接地" : "離地";
                  const isAuto = !isContact && !calibrationMode;
                  
                  return (
                    <div 
                      key={index}
                      className="marker-indicator"
                      style={{
                        backgroundColor: color,
                        color: "white",
                        padding: "20px",
                        borderRadius: "12px",
                        fontSize: "28px",
                        fontWeight: "bold",
                        textAlign: "center",
                        boxShadow: "0 4px 8px rgba(0,0,0,0.3)"
                      }}
                    >
                      {label} #{Math.floor(index / 2) + 1}
                      {isAuto && <div style={{ fontSize: '14px', marginTop: '4px' }}>（自動判定）</div>}
                    </div>
                  );
                }
                return null;
              })}
              {contactFrames.every(f => f !== currentFrame) && (
                <button 
                  className="btn-mark-contact-large"
                  onClick={() => {
                    if (!ready) return;
                    
                    if (calibrationMode) {
                      // キャリブレーションモード
                      if (manualContactFrames.length === 0) {
                        setManualContactFrames([currentFrame]);
                        console.log(`📍 キャリブレーション: 接地フレーム ${currentFrame}`);
                      } else if (autoToeOffFrames.length === 0) {
                        const contactFrame = manualContactFrames[0];
                        if (currentFrame <= contactFrame) {
                          alert('離地フレームは接地フレームより後にしてください。');
                          return;
                        }
                        const success = handleCalibration(contactFrame, currentFrame);
                        if (success) {
                          setAutoToeOffFrames([currentFrame]);
                          console.log(`📍 キャリブレーション: 離地フレーム ${currentFrame}`);
                        }
                      }
                    } else {
                      // 自動判定モード
                      const newContactFrames = [...manualContactFrames, currentFrame];
                      setManualContactFrames(newContactFrames);
                      console.log(`📍 接地マーク: フレーム ${currentFrame}`);
                      
                      const toeOffFrame = detectToeOffFrame(currentFrame);
                      if (toeOffFrame !== null) {
                        setAutoToeOffFrames([...autoToeOffFrames, toeOffFrame]);
                      } else {
                        console.warn(`⚠️ 離地が検出できませんでした（接地: ${currentFrame}）`);
                      }
                    }
                  }}
                  disabled={!ready}
                  style={{
                    width: "100%",
                    padding: "20px",
                    fontSize: "20px",
                    fontWeight: "bold",
                    background: calibrationMode 
                      ? (manualContactFrames.length === 0 
                          ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" 
                          : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)")
                      : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                    touchAction: "manipulation"
                  }}
                >
                  {calibrationMode 
                    ? (manualContactFrames.length === 0 ? '📍 接地マーク' : '📍 離地マーク')
                    : '📍 接地マーク（離地自動）'}
                </button>
              )}
            </div>
            )}
            
            {/* PC用：キーボード操作の説明 */}
            {!isMobile && (
              <div style={{
                background: '#f3f4f6',
                padding: '16px',
                borderRadius: '8px',
                margin: '16px 0',
                fontSize: '0.9rem'
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>⌨️ キーボード操作</h4>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li><strong>Space</strong>: {calibrationMode 
                    ? (manualContactFrames.length === 0 ? '接地マーク' : '離地マーク')
                    : '接地マーク（離地自動）'}</li>
                  <li><strong>← / →</strong>: 1フレーム移動</li>
                  <li><strong>↑ / ↓</strong>: 10フレーム移動</li>
                </ul>
              </div>
            )}

            {/* 表示オプションボタン - マーカーの下に配置 */}
            {isMobile && (
            <div className="mobile-view-options">
              <button
                className={footZoomEnabled ? "toggle-btn active" : "toggle-btn"}
                onClick={() => setFootZoomEnabled((v) => !v)}
              >
                足元拡大 {footZoomEnabled ? "ON" : "OFF"}
              </button>
              {footZoomEnabled && (
                <div className="zoom-slider-compact">
                  <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>倍率:</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.5}
                    value={zoomScale}
                    onChange={(e) => setZoomScale(Number(e.target.value))}
                    style={{ flex: 1, minWidth: '80px' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', minWidth: '35px', textAlign: 'center' }}>
                    {zoomScale.toFixed(1)}x
                  </span>
                </div>
              )}
              <button
                className={showSkeleton ? "toggle-btn active" : "toggle-btn"}
                onClick={() => setShowSkeleton((v) => !v)}
                disabled={!poseResults.length}
              >
                スケルトン {showSkeleton ? "ON" : "OFF"}
              </button>
            </div>
            )}

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

{/* PC用：マーカーリスト表示 */}
            {!isMobile && contactFrames.length > 0 && (
              <div style={{
                background: '#f9fafb',
                padding: '16px',
                borderRadius: '8px',
                margin: '16px 0',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>📍 マーカー一覧</h4>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {Array.from({ length: Math.floor(contactFrames.length / 2) }, (_, i) => {
                    const contactFrame = contactFrames[i * 2];
                    const toeOffFrame = contactFrames[i * 2 + 1];
                    const isAuto = !calibrationMode && i > 0;
                    
                    return (
                      <div key={i} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px',
                        background: 'white',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        border: currentFrame === contactFrame || currentFrame === toeOffFrame ? '2px solid #3b82f6' : '1px solid #e5e7eb'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <strong>ステップ {i + 1}:</strong>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                            🟢 接地 {contactFrame}
                          </span>
                          <span>→</span>
                          <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                            🔴 離地 {toeOffFrame}
                            {isAuto && <span style={{ fontSize: '0.75rem', marginLeft: '4px', color: '#6b7280' }}>(自動)</span>}
                          </span>
                        </div>
                        
                        {/* 離地フレームの微調整ボタン */}
                        {isAuto && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            paddingTop: '8px',
                            borderTop: '1px solid #e5e7eb'
                          }}>
                            <span style={{ fontSize: '0.8rem', color: '#6b7280', minWidth: '80px' }}>離地を微調整:</span>
                            <button
                              onClick={() => {
                                const newFrames = [...contactFrames];
                                const adjustedFrame = Math.max(contactFrame + 1, toeOffFrame - 5);
                                newFrames[i * 2 + 1] = adjustedFrame;
                                
                                // manualContactFramesとautoToeOffFramesを再構成
                                const newManual = newFrames.filter((_, idx) => idx % 2 === 0);
                                const newAuto = newFrames.filter((_, idx) => idx % 2 === 1).slice(1); // 最初はキャリブレーション
                                setManualContactFrames(newManual);
                                setAutoToeOffFrames(newAuto);
                              }}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.8rem',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                background: 'white',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              -5
                            </button>
                            <button
                              onClick={() => {
                                const newFrames = [...contactFrames];
                                const adjustedFrame = Math.max(contactFrame + 1, toeOffFrame - 1);
                                newFrames[i * 2 + 1] = adjustedFrame;
                                
                                const newManual = newFrames.filter((_, idx) => idx % 2 === 0);
                                const newAuto = newFrames.filter((_, idx) => idx % 2 === 1).slice(1);
                                setManualContactFrames(newManual);
                                setAutoToeOffFrames(newAuto);
                              }}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.8rem',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                background: 'white',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              -1
                            </button>
                            <button
                              onClick={() => {
                                const newFrames = [...contactFrames];
                                const adjustedFrame = Math.min(framesCount - 1, toeOffFrame + 1);
                                newFrames[i * 2 + 1] = adjustedFrame;
                                
                                const newManual = newFrames.filter((_, idx) => idx % 2 === 0);
                                const newAuto = newFrames.filter((_, idx) => idx % 2 === 1).slice(1);
                                setManualContactFrames(newManual);
                                setAutoToeOffFrames(newAuto);
                              }}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.8rem',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                background: 'white',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              +1
                            </button>
                            <button
                              onClick={() => {
                                const newFrames = [...contactFrames];
                                const adjustedFrame = Math.min(framesCount - 1, toeOffFrame + 5);
                                newFrames[i * 2 + 1] = adjustedFrame;
                                
                                const newManual = newFrames.filter((_, idx) => idx % 2 === 0);
                                const newAuto = newFrames.filter((_, idx) => idx % 2 === 1).slice(1);
                                setManualContactFrames(newManual);
                                setAutoToeOffFrames(newAuto);
                              }}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.8rem',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                background: 'white',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              +5
                            </button>
                            <button
                              onClick={() => {
                                setCurrentFrame(toeOffFrame);
                              }}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.8rem',
                                borderRadius: '4px',
                                border: '1px solid #3b82f6',
                                background: '#eff6ff',
                                color: '#3b82f6',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                marginLeft: '8px'
                              }}
                            >
                              📍 表示
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
              {/* AI評価セクション */}
              {runningEvaluation && (
                <div className="result-card" style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}>
                  <h3 className="result-card-title" style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🤖 AI フォーム評価
                  </h3>
                  
                  {/* 総合評価 */}
                  <div style={{
                    padding: '20px',
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px' }}>
                      {runningEvaluation.overallRating}
                    </div>
                    <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>
                      {runningEvaluation.overallMessage}
                    </div>
                    <div style={{ 
                      marginTop: '12px', 
                      display: 'flex', 
                      gap: '4px', 
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      {[1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          style={{
                            width: '40px',
                            height: '8px',
                            borderRadius: '4px',
                            background: i <= runningEvaluation.avgScore 
                              ? 'rgba(255,255,255,0.9)' 
                              : 'rgba(255,255,255,0.2)'
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 詳細評価 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {runningEvaluation.evaluations.map((evaluation, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '16px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          borderLeft: '4px solid ' + (
                            evaluation.score === 'excellent' ? '#10b981' :
                            evaluation.score === 'good' ? '#3b82f6' :
                            evaluation.score === 'fair' ? '#f59e0b' :
                            '#ef4444'
                          )
                        }}
                      >
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          marginBottom: '8px'
                        }}>
                          <span style={{ fontSize: '1.5rem' }}>{evaluation.icon}</span>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                              {evaluation.category}
                            </div>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                              {evaluation.message}
                            </div>
                          </div>
                        </div>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          lineHeight: '1.5',
                          opacity: 0.85,
                          paddingLeft: '36px'
                        }}>
                          💡 {evaluation.advice}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 100m目標記録入力セクション */}
              <div className="result-card">
                <h3 className="result-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🎯 100m 目標記録アドバイス
                </h3>
                
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    color: '#374151'
                  }}>
                    100mの目標タイム（秒）を入力してください
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="number"
                      step="0.1"
                      min="10"
                      max="30"
                      value={target100mInput}
                      onChange={(e) => setTarget100mInput(e.target.value)}
                      placeholder="例: 14.5"
                      style={{
                        flex: 1,
                        padding: '12px',
                        fontSize: '1.1rem',
                        borderRadius: '8px',
                        border: '2px solid #e5e7eb',
                        background: 'white',
                        color: '#1f2937'
                      }}
                    />
                    <button
                      onClick={() => {
                        const targetTime = parseFloat(target100mInput);
                        if (isNaN(targetTime) || targetTime <= 0) {
                          alert('正しい目標タイムを入力してください（例: 14.5秒）');
                          return;
                        }
                        if (targetTime < 10 || targetTime > 30) {
                          alert('目標タイムは10秒〜30秒の範囲で入力してください');
                          return;
                        }
                        const advice = generateTargetAdvice(targetTime);
                        setTargetAdvice(advice);
                      }}
                      style={{
                        padding: '12px 24px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        color: 'white',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 6px rgba(245, 87, 108, 0.3)'
                      }}
                    >
                      アドバイス生成
                    </button>
                  </div>
                </div>

                {targetAdvice && (
                  <div style={{
                    padding: '24px',
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.95rem',
                    lineHeight: '1.8',
                    maxHeight: '600px',
                    overflowY: 'auto',
                    color: '#1f2937'
                  }}>
                    {/* Markdownスタイルのテキストを見やすく表示 */}
                    <div style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      {targetAdvice.split('\n').map((line, i) => {
                        // 見出し1 (###)
                        if (line.startsWith('### ')) {
                          return (
                            <h3 key={i} style={{
                              fontSize: '1.3rem',
                              fontWeight: 'bold',
                              marginTop: i === 0 ? '0' : '24px',
                              marginBottom: '12px',
                              color: '#1f2937',
                              borderBottom: '2px solid #f093fb',
                              paddingBottom: '8px'
                            }}>
                              {line.replace('### ', '')}
                            </h3>
                          );
                        }
                        // 見出し2 (####)
                        if (line.startsWith('#### ')) {
                          return (
                            <h4 key={i} style={{
                              fontSize: '1.15rem',
                              fontWeight: 'bold',
                              marginTop: '16px',
                              marginBottom: '8px',
                              color: '#374151'
                            }}>
                              {line.replace('#### ', '')}
                            </h4>
                          );
                        }
                        // 見出し3 (#)
                        if (line.startsWith('## ')) {
                          return (
                            <h2 key={i} style={{
                              fontSize: '1.5rem',
                              fontWeight: 'bold',
                              marginTop: i === 0 ? '0' : '28px',
                              marginBottom: '16px',
                              color: '#111827',
                              borderBottom: '3px solid #f5576c',
                              paddingBottom: '10px'
                            }}>
                              {line.replace('## ', '')}
                            </h2>
                          );
                        }
                        // 箇条書き (-)
                        if (line.trim().startsWith('- ')) {
                          return (
                            <div key={i} style={{
                              marginLeft: '20px',
                              marginBottom: '6px',
                              display: 'flex',
                              gap: '8px'
                            }}>
                              <span style={{ color: '#f093fb', fontWeight: 'bold' }}>•</span>
                              <span>{line.trim().replace('- ', '')}</span>
                            </div>
                          );
                        }
                        // 数字付き箇条書き (1. 2. など)
                        if (/^\d+\.\s/.test(line.trim())) {
                          return (
                            <div key={i} style={{
                              marginLeft: '20px',
                              marginBottom: '6px',
                              display: 'flex',
                              gap: '8px'
                            }}>
                              <span style={{ 
                                color: '#f5576c', 
                                fontWeight: 'bold',
                                minWidth: '24px'
                              }}>
                                {line.trim().match(/^\d+\./)?.[0]}
                              </span>
                              <span>{line.trim().replace(/^\d+\.\s/, '')}</span>
                            </div>
                          );
                        }
                        // 引用 (>)
                        if (line.trim().startsWith('> ')) {
                          return (
                            <div key={i} style={{
                              background: '#f3f4f6',
                              borderLeft: '4px solid #f093fb',
                              padding: '12px 16px',
                              marginTop: '12px',
                              marginBottom: '12px',
                              borderRadius: '0 8px 8px 0',
                              fontStyle: 'italic',
                              color: '#4b5563'
                            }}>
                              {line.replace('> ', '')}
                            </div>
                          );
                        }
                        // 区切り線 (---)
                        if (line.trim() === '---') {
                          return (
                            <hr key={i} style={{
                              border: 'none',
                              borderTop: '2px solid #e5e7eb',
                              margin: '24px 0'
                            }} />
                          );
                        }
                        // 太字 (**)
                        if (line.includes('**')) {
                          const parts = line.split('**');
                          return (
                            <p key={i} style={{ marginBottom: '8px', color: '#374151' }}>
                              {parts.map((part, j) => 
                                j % 2 === 1 ? <strong key={j} style={{ color: '#1f2937' }}>{part}</strong> : part
                              )}
                            </p>
                          );
                        }
                        // 通常のテキスト
                        if (line.trim()) {
                          return (
                            <p key={i} style={{ 
                              marginBottom: '8px',
                              color: '#374151'
                            }}>
                              {line}
                            </p>
                          );
                        }
                        // 空行
                        return <div key={i} style={{ height: '8px' }} />;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ナビゲーションボタン */}
              <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                <button
                  className="wizard-btn secondary"
                  onClick={() => setWizardStep(5)}
                >
                  前へ: マーカー設定
                </button>
                <button
                  className="wizard-btn"
                  onClick={() => setWizardStep(7)}
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
                  }}
                >
                  次へ: データ詳細（プロ版） 🔒
                </button>
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="wizard-content">
            <div className="wizard-step-header">
              <h2 className="wizard-step-title">ステップ 7: データ詳細（プロ版）</h2>
              <p className="wizard-step-desc">
                詳細なステップメトリクス、グラフ、関節角度データを確認できます。
              </p>
              
              {/* ベータ版案内 */}
              <div style={{
                padding: '16px',
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                borderRadius: '12px',
                marginTop: '20px',
                color: 'white',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
              }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>
                  🚀 ベータ版として公開中
                </div>
                <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                  現在、このページの機能は全ユーザーに無料で公開されています。<br />
                  正式版リリース後は、プロ版会員限定機能となります。
                </div>
              </div>
            </div>

            {/* 全ユーザーに表示（ベータ版） */}
            <>
                {/* ステップメトリクス */}
                <div className="result-card">
                <h3 className="result-card-title">ステップメトリクス</h3>
                {stepMetrics.length > 0 ? (
                  <>
                    {/* 中間地点がある場合は前半・後半の比較を表示 */}
                    {sectionMidFrame != null && (
                      <div style={{
                        padding: '16px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        color: 'white'
                      }}>
                        <h4 style={{ fontSize: '1.1rem', marginBottom: '12px', fontWeight: '600' }}>
                          前半 vs 後半 比較
                        </h4>
                        {(() => {
                          const firstHalf = stepMetrics.filter(m => m.contactFrame < sectionMidFrame);
                          const secondHalf = stepMetrics.filter(m => m.contactFrame >= sectionMidFrame);
                          
                          const calcAvg = (arr: StepMetric[], key: keyof StepMetric) => {
                            const values = arr.map(m => m[key] as number).filter(v => v != null && !isNaN(v));
                            return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
                          };
                          
                          const firstHalfAvg = {
                            contact: calcAvg(firstHalf, 'contactTime'),
                            flight: calcAvg(firstHalf, 'flightTime'),
                            pitch: calcAvg(firstHalf, 'stepPitch'),
                            stride: calcAvg(firstHalf, 'stride'),
                            speed: calcAvg(firstHalf, 'speedMps'),
                          };
                          
                          const secondHalfAvg = {
                            contact: calcAvg(secondHalf, 'contactTime'),
                            flight: calcAvg(secondHalf, 'flightTime'),
                            pitch: calcAvg(secondHalf, 'stepPitch'),
                            stride: calcAvg(secondHalf, 'stride'),
                            speed: calcAvg(secondHalf, 'speedMps'),
                          };
                          
                          return (
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                              gap: '12px' 
                            }}>
                              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>前半 接地時間</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginTop: '4px' }}>
                                  {firstHalfAvg.contact?.toFixed(3) ?? 'ー'}s
                                </div>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>後半 接地時間</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginTop: '4px' }}>
                                  {secondHalfAvg.contact?.toFixed(3) ?? 'ー'}s
                                </div>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>前半 ピッチ</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginTop: '4px' }}>
                                  {firstHalfAvg.pitch?.toFixed(2) ?? 'ー'}歩/s
                                </div>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>後半 ピッチ</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginTop: '4px' }}>
                                  {secondHalfAvg.pitch?.toFixed(2) ?? 'ー'}歩/s
                                </div>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>前半 ストライド</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginTop: '4px' }}>
                                  {firstHalfAvg.stride?.toFixed(2) ?? 'ー'}m
                                </div>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>後半 ストライド</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginTop: '4px' }}>
                                  {secondHalfAvg.stride?.toFixed(2) ?? 'ー'}m
                                </div>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>前半 スピード</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginTop: '4px' }}>
                                  {firstHalfAvg.speed?.toFixed(2) ?? 'ー'}m/s
                                </div>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>後半 スピード</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginTop: '4px' }}>
                                  {secondHalfAvg.speed?.toFixed(2) ?? 'ー'}m/s
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
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
            </>

            {/* ナビゲーションボタン */}
            <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                className="wizard-btn secondary"
                onClick={() => setWizardStep(6)}
              >
                前へ: 解析結果
              </button>
              <button
                className="wizard-btn danger"
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
                    setSectionMidFrame(null);
                    setSectionEndFrame(null);
                    setStartLineOffset(0);
                    setMidLineOffset(0);
                    setEndLineOffset(0);
                    setSavedStartHipX(null);
                    setSavedMidHipX(null);
                    setSavedEndHipX(null);
                    setManualContactFrames([]);
                    setAutoToeOffFrames([]);
                    setCalibrationMode(true);
                    setToeOffThreshold(null);
                    setBaseThreshold(null);
                    setPoseResults([]);
                    setStatus("");
                    setWizardStep(0);
                    setDistanceInput("10");
                    setLabelInput("");
                    setNotesInput("");
                    setAthleteInfo({
                      name: '',
                      age: null,
                      gender: null,
                      affiliation: '',
                      height_cm: null,
                      current_record: '',
                      target_record: '',
                    });
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

  // デバッグ: 画面幅を検出
  const [screenWidth, setScreenWidth] = React.useState(window.innerWidth);
  React.useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 認証は AppWithAuth で処理済み

  // チュートリアルのステップデータ
  const tutorialSteps = [
    {
      title: "ようこそ！ランニング動作解析システムへ",
      content: "このアプリでは、動画からランニングフォームを科学的に分析できます。\n7つのステップで解析を進めていきましょう。"
    },
    {
      title: "ステップ0: 測定者情報の入力",
      content: "測定者の基本情報を入力します。\n\n• 氏名、年齢、性別（必須）\n• 身長（ストライド分析に使用）\n• 目標記録（AIアドバイスに使用）"
    },
    {
      title: "ステップ1: 動画のアップロード",
      content: "ランニング動画をアップロードしてください。\n\n• 横から撮影した動画が最適です\n• 10m以上の走行が収まっている動画を推奨\n• MP4、MOV、WebM形式に対応"
    },
    {
      title: "ステップ2: フレーム抽出",
      content: "動画を個別のフレームに分割します。\n\n• 目標FPSを設定（推奨: 30fps）\n• 抽出開始をクリック\n• 処理には数秒かかります"
    },
    {
      title: "ステップ3: 姿勢推定",
      content: "各フレームから骨格情報を抽出します。\n\n• MediaPipe Poseを使用\n• 自動的に関節位置を検出\n• スケルトン表示で確認可能"
    },
    {
      title: "ステップ4: 区間設定",
      content: "解析する区間を設定します。\n\n• スタート地点を設定\n• エンド地点を設定\n• 距離（m）を入力（例: 10m）"
    },
    {
      title: "ステップ5: マーカー設定",
      content: "接地・離地のタイミングをマークします。\n\n• 最初の1歩：手動でマーク（キャリブレーション）\n• 2歩目以降：自動検出\n• PC: Spaceキー、モバイル: タップでマーク"
    },
    {
      title: "ステップ6: 結果確認",
      content: "解析結果を確認しましょう！\n\n• AI評価：フォームの総合評価\n• 100m目標記録：目標達成のためのアドバイス"
    },
    {
      title: "ステップ7: データ詳細（プロ版）",
      content: "詳細なデータ分析（プロ版機能）\n\n• ステップメトリクス：詳細な数値データ\n• グラフ：各指標の推移を可視化\n• 3局面の関節角度：詳細な姿勢データ\n\n※ プロ版会員のみ閲覧可能"
    }
  ];

  return (
    <div className="app-container">
      {/* チュートリアルモーダル */}
      {showTutorial && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            {/* ヘッダー */}
            <div style={{
              padding: '24px',
              borderBottom: '2px solid #f0f0f0',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '16px 16px 0 0'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                {tutorialSteps[tutorialStep].title}
              </h2>
              <div style={{ marginTop: '12px', fontSize: '0.9rem', opacity: 0.9 }}>
                ステップ {tutorialStep + 1} / {tutorialSteps.length}
              </div>
            </div>

            {/* コンテンツ */}
            <div style={{
              padding: '32px 24px',
              fontSize: '1rem',
              lineHeight: '1.8',
              color: '#374151',
              whiteSpace: 'pre-line'
            }}>
              {tutorialSteps[tutorialStep].content}
            </div>

            {/* プログレスバー */}
            <div style={{
              padding: '0 24px 24px',
              display: 'flex',
              gap: '8px'
            }}>
              {tutorialSteps.map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: '4px',
                    borderRadius: '2px',
                    background: i <= tutorialStep ? '#667eea' : '#e5e7eb'
                  }}
                />
              ))}
            </div>

            {/* ボタン */}
            <div style={{
              padding: '0 24px 24px',
              display: 'flex',
              gap: '12px',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => setShowTutorial(false)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  background: 'white',
                  color: '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                スキップ
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                {tutorialStep > 0 && (
                  <button
                    onClick={() => setTutorialStep(tutorialStep - 1)}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      border: '2px solid #667eea',
                      background: 'white',
                      color: '#667eea',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    戻る
                  </button>
                )}
                <button
                  onClick={() => {
                    if (tutorialStep < tutorialSteps.length - 1) {
                      setTutorialStep(tutorialStep + 1);
                    } else {
                      setShowTutorial(false);
                    }
                  }}
                  style={{
                    padding: '12px 32px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                  }}
                >
                  {tutorialStep < tutorialSteps.length - 1 ? '次へ' : '始める！'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー - ステップ1のみ表示 */}
      {wizardStep === 1 && (
        <header className="app-header-new">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <h1 className="app-title-new">🏃‍♂️ Running Analysis Studio</h1>
              <p className="app-subtitle-new">
                フレーム抽出・姿勢推定・関節角度とステップ指標を一括解析
              </p>
            </div>
            <div>
              {userProfile && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      setShowTutorial(true);
                      setTutorialStep(0);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>❓</span>
                    <span>使い方</span>
                  </button>
                  <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                    👤 {userProfile.name}
                  </span>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '4px 8px', 
                    background: 'rgba(255,255,255,0.2)', 
                    borderRadius: '4px',
                    fontWeight: 'bold'
                  }}>
                    デベロッパー版 (12月末まで無料)
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

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
