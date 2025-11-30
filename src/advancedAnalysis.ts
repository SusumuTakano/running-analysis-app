/** メモリ効率のための軽量フレームデータ */
export type LightFrameData = {
  frameNumber: number;
  timestamp: number;
  landmarks: Float32Array; // x, y, z, visibility を圧縮
};

/** つま先軌道データ */
export type ToeTrajectoryPoint = {
  frame: number;
  height: number;
  velocity: number;
  isDescending: boolean;
  isLowest: boolean;
  isRising: boolean;
};

/** ステップメトリクス */
export type StepMetric = {
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

/** 高度な接地・離地検出結果 */
export type AdvancedDetectionResult = {
  contactFrames: number[];
  toeOffFrames: number[];
  trajectory: ToeTrajectoryPoint[];
  confidence: number;
};

/** メモリ効率のための圧縮 */
export const compressLandmarks = (landmarks: any[]): Float32Array => {
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
export const decompressLandmarks = (compressed: Float32Array): Array<{ x: number; y: number; z: number; visibility: number }> => {
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

/** つま先の高さを取得 */
const getToeHeight = (landmarks: any[]): number | null => {
  const leftToe = landmarks[31];
  const rightToe = landmarks[32];
  
  if (!leftToe || !rightToe || leftToe.visibility < 0.5 || rightToe.visibility < 0.5) {
    return null;
  }
  
  return Math.min(leftToe.y, rightToe.y);
};

/** つま先軌道を分析 */
export const analyzeToeTrajectory = (frames: LightFrameData[]): ToeTrajectoryPoint[] => {
  const trajectory: ToeTrajectoryPoint[] = [];
  const windowSize = 5; // 移動平均ウィンドウサイズ
  
  // 1. まず生の高さデータを収集
  const rawHeights: (number | null)[] = [];
  for (const frame of frames) {
    const landmarks = decompressLandmarks(frame.landmarks);
    const height = getToeHeight(landmarks);
    rawHeights.push(height);
  }
  
  // null値を除外して数値配列を作成
  const validHeights = rawHeights.filter(h => h !== null) as number[];
  if (validHeights.length === 0) return [];
  
  // 2. 移動平均で平滑化
  const smoothedHeights = smoothArray(validHeights, windowSize);
  
  // 3. 速度と変化を計算
  for (let i = 1; i < smoothedHeights.length - 1; i++) {
    const current = smoothedHeights[i];
    const prev = smoothedHeights[i - 1];
    const next = smoothedHeights[i + 1];
    
    if (current === null || prev === null || next === null) {
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
    const isDescending = velocity > 0.3; // 下降しきった状態
    const isRising = velocity < -0.3; // 上昇開始
    const isLowest = Math.abs(velocity) < 0.1 && next - current > 0.2; // 最低点
    
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

/** 配列の平滑化 */
const smoothArray = (arr: (number | null)[], windowSize: number): (number | null)[] => {
  const result: (number | null)[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = -halfWindow; j <= halfWindow; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < arr.length && arr[idx] !== null && !isNaN(arr[idx]!)) {
        sum += arr[idx]!;
        count++;
      }
    }
    
    result.push(count > 0 ? sum / count : null);
  }
  
  return result;
};

/** 関節角度から接地を検出 */
const detectContactFromJoints = (frames: LightFrameData[]): number[] => {
  const contacts: number[] = [];
  
  for (let i = 1; i < frames.length; i++) {
    const currentLandmarks = decompressLandmarks(frames[i].landmarks);
    const prevLandmarks = decompressLandmarks(frames[i - 1].landmarks);
    
    // 膝の角度が急激に変化する点を検出
    const kneeAngleChange = calculateKneeAngleChange(currentLandmarks, prevLandmarks);
    
    if (kneeAngleChange > 15) { // 15度以上の変化
      contacts.push(i);
    }
  }
  
  return contacts;
};

/** 関節角度から離地を検出 */
const detectToeOffFromJoints = (frames: LightFrameData[]): number[] => {
  const toeOffs: number[] = [];
  
  for (let i = 1; i < frames.length; i++) {
    const currentLandmarks = decompressLandmarks(frames[i].landmarks);
    const prevLandmarks = decompressLandmarks(frames[i - 1].landmarks);
    
    // 足首の角度変化を検出
    const anklePlantarflexion = detectAnklePlantarflexion(currentLandmarks, prevLandmarks);
    
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
    
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
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
    
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
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

/** 高度な接地・離地検出 */
export const detectContactAndToeOffAdvanced = (
  frames: LightFrameData[],
  trajectory?: ToeTrajectoryPoint[]
): AdvancedDetectionResult => {
  // つま先軌道が提供されていない場合は計算
  if (!trajectory) {
    trajectory = analyzeToeTrajectory(frames);
  }
  
  // 1. つま先軌道からの検出
  const trajectoryContacts: number[] = [];
  const trajectoryToeOffs: number[] = [];
  
  for (let i = 1; i < trajectory.length - 1; i++) {
    const current = trajectory[i];
    const prev = trajectory[i - 1];
    
    // 下降→上昇の転換点（最低点）を接地として検出
    if (current.isLowest) {
      trajectoryContacts.push(current.frame);
    }
    
    // 上昇開始を離地として検出
    if (prev && !prev.isRising && current.isRising) {
      trajectoryToeOffs.push(current.frame);
    }
  }
  
  // 2. 関節角度からの補助的検出
  const jointContacts = detectContactFromJoints(frames);
  const jointToeOffs = detectToeOffFromJoints(frames);
  
  // 3. 2つの方法の結果を統合（信頼度の高いものを優先）
  const finalContacts = mergeDetections(trajectoryContacts, jointContacts, 0.8);
  const finalToeOffs = mergeDetections(trajectoryToeOffs, jointToeOffs, 0.7);
  
  // 信頼度を計算
  const confidence = calculateDetectionConfidence(
    finalContacts,
    finalToeOffs,
    frames.length,
    trajectory
  );
  
  return {
    contactFrames: finalContacts,
    toeOffFrames: finalToeOffs,
    trajectory,
    confidence
  };
};

/** 検出信頼度を計算 */
const calculateDetectionConfidence = (
  contacts: number[],
  toeOffs: number[],
  totalFrames: number,
  trajectory: ToeTrajectoryPoint[]
): number => {
  if (contacts.length === 0 || toeOffs.length === 0) return 0;
  
  // 1. 検出数の妥当性
  const expectedSteps = Math.floor(totalFrames / 20); // 20フレームに1歩と仮定
  const contactRatio = Math.min(contacts.length / expectedSteps, 1);
  const toeOffRatio = Math.min(toeOffs.length / expectedSteps, 1);
  
  // 2. 軌道との一致度
  let trajectoryMatch = 0;
  for (const contact of contacts) {
    const nearbyTrajectory = trajectory.find(t => Math.abs(t.frame - contact) < 3);
    if (nearbyTrajectory && nearbyTrajectory.isLowest) {
      trajectoryMatch++;
    }
  }
  const trajectoryConfidence = contacts.length > 0 ? trajectoryMatch / contacts.length : 0;
  
  // 3. 離地と接地の整合性
  const consistency = calculateStepConsistency(contacts, toeOffs);
  
  // 総合信頼度
  return (contactRatio * 0.3 + toeOffRatio * 0.3 + trajectoryConfidence * 0.3 + consistency * 0.1);
};

/** ステップの整合性を計算 */
const calculateStepConsistency = (contacts: number[], toeOffs: number[]): number => {
  if (contacts.length < 2) return 0;
  
  // ステップ時間のばらつきを計算
  const stepDurations: number[] = [];
  for (let i = 1; i < contacts.length; i++) {
    stepDurations.push(contacts[i] - contacts[i - 1]);
  }
  
  if (stepDurations.length === 0) return 0;
  
  const avgDuration = stepDurations.reduce((a, b) => a + b, 0) / stepDurations.length;
  const variances = stepDurations.map(d => Math.abs(d - avgDuration));
  const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
  
  // 変動係数が小さいほど高い信頼度
  const coefficientOfVariation = avgVariance / avgDuration;
  return Math.max(0, 1 - coefficientOfVariation);
};

/** ステップメトリクスを計算 */
export const calculateStepMetrics = (
  contactFrames: number[],
  toeOffFrames: number[],
  fps: number
): StepMetric[] => {
  const stepMetrics: StepMetric[] = [];
  
  for (let i = 0; i < contactFrames.length - 1; i++) {
    const contactFrame = contactFrames[i];
    const nextContactFrame = contactFrames[i + 1];
    
    // このステップの離地フレームを見つける
    let toeOffFrame = -1;
    for (const tof of toeOffFrames) {
      if (tof > contactFrame && tof < nextContactFrame) {
        toeOffFrame = tof;
        break;
      }
    }
    
    if (toeOffFrame === -1) continue; // 離地が見つからない場合はスキップ
    
    const contactTime = (toeOffFrame - contactFrame) / fps;
    const flightTime = (nextContactFrame - toeOffFrame) / fps;
    const stepTime = (nextContactFrame - contactFrame) / fps;
    const stepPitch = 1 / stepTime;
    
    stepMetrics.push({
      index: i,
      contactFrame,
      toeOffFrame,
      nextContactFrame,
      contactTime,
      flightTime,
      stepTime,
      stepPitch,
      stride: 0, // 後で計算
      speedMps: 0, // 後で計算
      acceleration: 0 // 後で計算
    });
  }
  
  return stepMetrics;
};