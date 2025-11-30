/**
 * 高精度歩行検出モジュール
 * 前半の歩行も逃さない、高精度な接地・離地検出
 */

import type { MediaPipeLandmark } from './HighAccuracyPoseEstimation';

export interface StepDetection {
  frameNumber: number;
  type: 'contact' | 'toeOff';
  confidence: number;
  side: 'left' | 'right' | 'both';
}

export interface EnhancedStepMetric {
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
  confidence: number;
  side: 'left' | 'right';
}

/**
 * 高精度歩行検出器
 * 前半の歩行も逃さない、マルチモーダルアプローチ
 */
export class HighAccuracyStepDetector {
  private readonly CONTACT_THRESHOLD = 0.3; // 接地検出しきい値（緩やか）
  private readonly TOE_OFF_THRESHOLD = 0.25; // 離地検出しきい値
  private readonly MIN_STEP_DURATION = 5; // 最小ステップ間隔（フレーム）
  private readonly VELOCITY_THRESHOLD = 0.2; // 速度変化しきい値
  
  // 複数の検出手法の重み付け
  private readonly DETECTION_WEIGHTS = {
    toeTrajectory: 0.35,     // つま先軌道
    jointAngle: 0.3,         // 関節角度
    velocityChange: 0.2,       // 速度変化
    heightChange: 0.15       // 高さ変化
  };

  /**
   * 高精度なステップ検出（前半の歩行も逃がさない）
   */
  detectStepsWithHighAccuracy(
    frames: Array<{ frameNumber: number; landmarks: MediaPipeLandmark[]; confidence: number }>,
    fps: number
  ): { 
    steps: StepDetection[]; 
    stepMetrics: EnhancedStepMetric[];
    detectionRate: number;
  } {
    
    if (frames.length < 10) {
      return { steps: [], stepMetrics: [], detectionRate: 0 };
    }

    console.log(`ステップ検出開始: ${frames.length}フレーム, FPS: ${fps}`);

    // 1. 複数の手法で独立して検出
    const trajectoryBased = this.detectFromToeTrajectory(frames);
    const jointBased = this.detectFromJointAngles(frames);
    const velocityBased = this.detectFromVelocityChanges(frames);
    const heightBased = this.detectFromHeightChanges(frames);

    console.log(`検出結果 - 軌道: ${trajectoryBased.length}, 関節: ${jointBased.length}, 速度: ${velocityBased.length}, 高さ: ${heightBased.length}`);

    // 2. 複数の手法の結果を統合（重み付き投票）
    const mergedDetections = this.mergeMultiModalDetections([
      { detections: trajectoryBased, weight: this.DETECTION_WEIGHTS.toeTrajectory },
      { detections: jointBased, weight: this.DETECTION_WEIGHTS.jointAngle },
      { detections: velocityBased, weight: this.DETECTION_WEIGHTS.velocityChange },
      { detections: heightBased, weight: this.DETECTION_WEIGHTS.heightChange }
    ]);

    console.log(`統合後の検出数: ${mergedDetections.length}`);

    // 3. 前半の歩行を逃さないための特別な処理
    const enhancedDetections = this.enhanceEarlySteps(mergedDetections, frames);

    // 4. ステップメトリクスを計算
    const stepMetrics = this.calculateStepMetrics(enhancedDetections, frames, fps);

    const detectionRate = frames.length > 0 ? (enhancedDetections.length / Math.max(1, Math.floor(frames.length / 15))) * 100 : 0;

    return {
      steps: enhancedDetections,
      stepMetrics,
      detectionRate
    };
  }

  /**
   * つま先軌道からの検出（微細な変化も捉える）
   */
  private detectFromToeTrajectory(frames: Array<{ frameNumber: number; landmarks: MediaPipeLandmark[] }>): StepDetection[] {
    const detections: StepDetection[] = [];
    
    if (frames.length < 5) return detections;

    // 左右のつま先の高さを追跡
    const leftToeHeights: number[] = [];
    const rightToeHeights: number[] = [];
    
    for (const frame of frames) {
      const leftToe = frame.landmarks[31]; // LEFT_FOOT_INDEX
      const rightToe = frame.landmarks[32]; // RIGHT_FOOT_INDEX
      
      leftToeHeights.push(leftToe?.visibility > 0.3 ? leftToe.y : NaN);
      rightToeHeights.push(rightToe?.visibility > 0.3 ? rightToe.y : NaN);
    }

    // 欠損値を補完
    this.interpolateMissingValues(leftToeHeights);
    this.interpolateMissingValues(rightToeHeights);

    // 平滑化（微細な動きを保持）
    const smoothLeft = this.smoothWithSmallWindow(leftToeHeights, 3);
    const smoothRight = this.smoothWithSmallWindow(rightToeHeights, 3);

    // 左右それぞれの検出
    const leftDetections = this.detectPeaksAndValleys(smoothLeft, frames, 'left');
    const rightDetections = this.detectPeaksAndValleys(smoothRight, frames, 'right');

    return [...leftDetections, ...rightDetections];
  }

  /**
   * 関節角度からの検出（膝と足首の角度変化を追跡）
   */
  private detectFromJointAngles(frames: Array<{ frameNumber: number; landmarks: MediaPipeLandmark[] }>): StepDetection[] {
    const detections: StepDetection[] = [];
    
    for (let i = 1; i < frames.length - 1; i++) {
      const prevFrame = frames[i - 1];
      const currFrame = frames[i];
      const nextFrame = frames[i + 1];

      // 膝角度の変化を計算
      const kneeAngleChange = this.calculateKneeAngleChange(prevFrame.landmarks, currFrame.landmarks);
      
      // 足首角度の変化を計算
      const ankleAngleChange = this.calculateAnkleAngleChange(prevFrame.landmarks, currFrame.landmarks);
      
      // 接地検出：膝角度が急激に減少（脚が伸びる）
      if (kneeAngleChange < -10 && ankleAngleChange < -5) {
        detections.push({
          frameNumber: currFrame.frameNumber,
          type: 'contact',
          confidence: Math.min(0.9, Math.abs(kneeAngleChange) / 20),
          side: 'both'
        });
      }
      
      // 離地検出：足首が底屈（つま先が下がる）
      if (ankleAngleChange > 8 && kneeAngleChange > 5) {
        detections.push({
          frameNumber: currFrame.frameNumber,
          type: 'toeOff',
          confidence: Math.min(0.9, ankleAngleChange / 15),
          side: 'both'
        });
      }
    }

    return detections;
  }

  /**
   * 速度変化からの検出
   */
  private detectFromVelocityChanges(frames: Array<{ frameNumber: number; landmarks: MediaPipeLandmark[] }>): StepDetection[] {
    const detections: StepDetection[] = [];
    
    for (let i = 2; i < frames.length - 2; i++) {
      const frame = frames[i];
      
      // 体の中心（腰）の移動速度を計算
      const centerVelocity = this.calculateCenterVelocity(frames, i);
      
      // 接地：速度が急激に減少（衝撃吸収）
      if (centerVelocity < -this.VELOCITY_THRESHOLD * 2) {
        detections.push({
          frameNumber: frame.frameNumber,
          type: 'contact',
          confidence: Math.min(0.8, Math.abs(centerVelocity) / 0.5),
          side: 'both'
        });
      }
      
      // 離地：速度が急激に増加（推進）
      if (centerVelocity > this.VELOCITY_THRESHOLD * 2) {
        detections.push({
          frameNumber: frame.frameNumber,
          type: 'toeOff',
          confidence: Math.min(0.8, centerVelocity / 0.5),
          side: 'both'
        });
      }
    }

    return detections;
  }

  /**
   * 高さ変化からの検出
   */
  private detectFromHeightChanges(frames: Array<{ frameNumber: number; landmarks: MediaPipeLandmark[] }>): StepDetection[] {
    const detections: StepDetection[] = [];
    
    // 体の中心（腰）の高さを追跡
    const centerHeights: number[] = [];
    
    for (const frame of frames) {
      const leftHip = frame.landmarks[23];
      const rightHip = frame.landmarks[24];
      
      if (leftHip?.visibility > 0.3 && rightHip?.visibility > 0.3) {
        centerHeights.push((leftHip.y + rightHip.y) / 2);
      } else {
        centerHeights.push(NaN);
      }
    }

    // 欠損値を補完
    this.interpolateMissingValues(centerHeights);

    for (let i = 1; i < centerHeights.length - 1; i++) {
      const currentHeight = centerHeights[i];
      const prevHeight = centerHeights[i - 1];
      const heightChange = currentHeight - prevHeight;
      
      // 体が下がる（接地）
      if (heightChange > 0.1) {
        detections.push({
          frameNumber: frames[i].frameNumber,
          type: 'contact',
          confidence: Math.min(0.8, heightChange / 0.5),
          side: 'both'
        });
      }
      
      // 体が上がる（離地）
      if (heightChange < -0.1) {
        detections.push({
          frameNumber: frames[i].frameNumber,
          type: 'toeOff',
          confidence: Math.min(0.8, Math.abs(heightChange) / 0.5),
          side: 'both'
        });
      }
    }

    return detections;
  }

  /**
   * 複数モダリティの検出結果を統合
   */
  private mergeMultiModalDetections(
    modalityResults: Array<{ detections: StepDetection[]; weight: number }>
  ): StepDetection[] {
    const allDetections: StepDetection[] = [];
    const voteMap = new Map<string, number>();

    // 各モダリティの検出に重み付け投票
    for (const { detections, weight } of modalityResults) {
      for (const detection of detections) {
        const key = `${detection.frameNumber}-${detection.type}`;
        voteMap.set(key, (voteMap.get(key) || 0) + weight * detection.confidence);
      }
    }

    // 信頼度の高い順にソート
    const sortedVotes = Array.from(voteMap.entries())
      .sort(([, a], [, b]) => b - a)
      .filter(([, confidence]) => confidence >= this.CONTACT_THRESHOLD);

    // 近接する検出をマージ
    const merged: StepDetection[] = [];
    const usedFrames = new Set<number>();

    for (const [key, confidence] of sortedVotes) {
      const [frameStr, type] = key.split('-');
      const frameNumber = parseInt(frameStr);
      
      // 近接フレームの重複を排除
      let isNearExisting = false;
      for (const existing of merged) {
        if (Math.abs(existing.frameNumber - frameNumber) < this.MIN_STEP_DURATION) {
          isNearExisting = true;
          break;
        }
      }
      
      if (!isNearExisting && !usedFrames.has(frameNumber)) {
        merged.push({
          frameNumber,
          type: type as 'contact' | 'toeOff',
          confidence,
          side: 'both'
        });
        usedFrames.add(frameNumber);
      }
    }

    return merged.sort((a, b) => a.frameNumber - b.frameNumber);
  }

  /**
   * 前半の歩行を逃さないための特別な処理
   */
  private enhanceEarlySteps(detections: StepDetection[], frames: any[]): StepDetection[] {
    if (detections.length === 0) return detections;

    const enhanced = [...detections];
    const firstDetection = detections[0];
    
    // 最初の検出までの間に、疑わしい歩行がないかチェック
    const suspiciousFrames = this.findSuspiciousFramesBeforeFirstDetection(frames, firstDetection);
    
    for (const suspicious of suspiciousFrames) {
      // 既存の検出と近接していないかチェック
      const isFarFromExisting = !enhanced.some(existing => 
        Math.abs(existing.frameNumber - suspicious.frameNumber) < this.MIN_STEP_DURATION
      );
      
      if (isFarFromExisting) {
        enhanced.push(suspicious);
      }
    }

    return enhanced.sort((a, b) => a.frameNumber - b.frameNumber);
  }

  /**
   * 最初の検出前の疑わしい歩行を発見
   */
  private findSuspiciousFramesBeforeFirstDetection(frames: any[], firstDetection: StepDetection): StepDetection[] {
    const suspicious: StepDetection[] = [];
    const searchEnd = Math.min(firstDetection.frameNumber, 30); // 最初の30フレームまで
    
    for (let i = 0; i < searchEnd - 5; i++) {
      const window = frames.slice(i, i + 5);
      
      if (window.length < 5) continue;
      
      // このウィンドウ内で動きがあるかチェック
      const hasMovement = this.detectMovementInWindow(window);
      
      if (hasMovement) {
        // 接地か離地のどちらかを推測
        const predictedType = this.predictStepType(window);
        
        suspicious.push({
          frameNumber: i + 2, // ウィンドウの中央
          type: predictedType,
          confidence: 0.6, // 低めの信頼度
          side: 'both'
        });
      }
    }

    return suspicious;
  }

  /**
   * ウィンドウ内の動きを検出
   */
  private detectMovementInWindow(window: any[]): boolean {
    let totalMovement = 0;
    
    for (let i = 1; i < window.length; i++) {
      const prevCenter = this.getBodyCenter(window[i - 1].landmarks);
      const currCenter = this.getBodyCenter(window[i].landmarks);
      
      if (prevCenter && currCenter) {
        const movement = Math.abs(currCenter.y - prevCenter.y);
        totalMovement += movement;
      }
    }
    
    return totalMovement > 0.05; // 閾値
  }

  /**
   * ステップタイプを予測
   */
  private predictStepType(window: any[]): 'contact' | 'toeOff' {
    const firstCenter = this.getBodyCenter(window[0].landmarks);
    const lastCenter = this.getBodyCenter(window[window.length - 1].landmarks);
    
    if (firstCenter && lastCenter) {
      const heightChange = lastCenter.y - firstCenter.y;
      return heightChange > 0 ? 'contact' : 'toeOff';
    }
    
    return 'contact';
  }

  /**
   * ステップメトリクスを計算
   */
  private calculateStepMetrics(detections: StepDetection[], frames: any[], fps: number): EnhancedStepMetric[] {
    const metrics: EnhancedStepMetric[] = [];
    
    // 接地と離地を分離
    const contacts = detections.filter(d => d.type === 'contact').sort((a, b) => a.frameNumber - b.frameNumber);
    const toeOffs = detections.filter(d => d.type === 'toeOff').sort((a, b) => a.frameNumber - b.frameNumber);
    
    let stepIndex = 0;
    
    for (let i = 0; i < contacts.length - 1; i++) {
      const contact = contacts[i];
      const nextContact = contacts[i + 1];
      
      // 対応する離地を探す
      const toeOff = toeOffs.find(t => t.frameNumber > contact.frameNumber && t.frameNumber < nextContact.frameNumber);
      
      if (toeOff) {
        const contactTime = (toeOff.frameNumber - contact.frameNumber) / fps;
        const flightTime = (nextContact.frameNumber - toeOff.frameNumber) / fps;
        const stepTime = (nextContact.frameNumber - contact.frameNumber) / fps;
        
        // 信頼度を計算
        const confidence = (contact.confidence + (toeOff?.confidence || 0) + nextContact.confidence) / 3;
        
        metrics.push({
          index: stepIndex++,
          contactFrame: contact.frameNumber,
          toeOffFrame: toeOff.frameNumber,
          nextContactFrame: nextContact.frameNumber,
          contactTime,
          flightTime,
          stepTime,
          stepPitch: null, // 後で計算
          stride: null, // 後で計算
          speedMps: null, // 後で計算
          acceleration: null, // 後で計算
          confidence,
          side: 'left' // 両脚として扱う
        });
      }
    }
    
    return metrics;
  }

  /**
   * 補助メソッド
   */
  private interpolateMissingValues(arr: number[]): void {
    // 単純な線形補間
    for (let i = 0; i < arr.length; i++) {
      if (isNaN(arr[i])) {
        const prev = this.findPreviousValid(arr, i);
        const next = this.findNextValid(arr, i);
        
        if (prev !== null && next !== null) {
          const distance = next.index - prev.index;
          const currentDistance = i - prev.index;
          arr[i] = prev.value + (next.value - prev.value) * (currentDistance / distance);
        }
      }
    }
  }

  private findPreviousValid(arr: number[], index: number): { value: number; index: number } | null {
    for (let i = index - 1; i >= 0; i--) {
      if (!isNaN(arr[i])) {
        return { value: arr[i], index: i };
      }
    }
    return null;
  }

  private findNextValid(arr: number[], index: number): { value: number; index: number } | null {
    for (let i = index + 1; i < arr.length; i++) {
      if (!isNaN(arr[i])) {
        return { value: arr[i], index: i };
      }
    }
    return null;
  }

  private smoothWithSmallWindow(arr: number[], windowSize: number): number[] {
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
      
      result.push(count > 0 ? sum / count : arr[i]);
    }
    
    return result;
  }

  private calculateKneeAngleChange(prevLandmarks: MediaPipeLandmark[], currLandmarks: MediaPipeLandmark[]): number {
    const prevLeftKnee = this.calculateSingleKneeAngle(prevLandmarks, 'left');
    const currLeftKnee = this.calculateSingleKneeAngle(currLandmarks, 'left');
    const prevRightKnee = this.calculateSingleKneeAngle(prevLandmarks, 'right');
    const currRightKnee = this.calculateSingleKneeAngle(currLandmarks, 'right');
    
    const leftChange = currLeftKnee - prevLeftKnee;
    const rightChange = currRightKnee - prevRightKnee;
    
    return Math.max(leftChange, rightChange);
  }

  private calculateAnkleAngleChange(prevLandmarks: MediaPipeLandmark[], currLandmarks: MediaPipeLandmark[]): number {
    const prevLeftAnkle = this.calculateSingleAnkleAngle(prevLandmarks, 'left');
    const currLeftAnkle = this.calculateSingleAnkleAngle(currLandmarks, 'left');
    const prevRightAnkle = this.calculateSingleAnkleAngle(prevLandmarks, 'right');
    const currRightAnkle = this.calculateSingleAnkleAngle(currLandmarks, 'right');
    
    const leftChange = currLeftAnkle - prevLeftAnkle;
    const rightChange = currRightAnkle - prevRightAnkle;
    
    return Math.max(leftChange, rightChange);
  }

  private calculateSingleKneeAngle(landmarks: MediaPipeLandmark[], side: 'left' | 'right'): number {
    const hipIndex = side === 'left' ? 23 : 24;
    const kneeIndex = side === 'left' ? 25 : 26;
    const ankleIndex = side === 'left' ? 27 : 28;
    
    const hip = landmarks[hipIndex];
    const knee = landmarks[kneeIndex];
    const ankle = landmarks[ankleIndex];
    
    if (!hip || !knee || !ankle || hip.visibility < 0.3 || knee.visibility < 0.3 || ankle.visibility < 0.3) {
      return 0;
    }
    
    return this.calculateAngle(hip, knee, ankle);
  }

  private calculateSingleAnkleAngle(landmarks: MediaPipeLandmark[], side: 'left' | 'right'): number {
    const kneeIndex = side === 'left' ? 25 : 26;
    const ankleIndex = side === 'left' ? 27 : 28;
    const toeIndex = side === 'left' ? 31 : 32;
    
    const knee = landmarks[kneeIndex];
    const ankle = landmarks[ankleIndex];
    const toe = landmarks[toeIndex];
    
    if (!knee || !ankle || !toe || knee.visibility < 0.3 || ankle.visibility < 0.3 || toe.visibility < 0.3) {
      return 0;
    }
    
    return this.calculateAngle(knee, ankle, toe);
  }

  private calculateAngle(a: MediaPipeLandmark, b: MediaPipeLandmark, c: MediaPipeLandmark): number {
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosAngle) * 180 / Math.PI;
  }

  private calculateCenterVelocity(frames: any[], index: number): number {
    if (index < 1 || index >= frames.length - 1) return 0;
    
    const prevCenter = this.getBodyCenter(frames[index - 1].landmarks);
    const nextCenter = this.getBodyCenter(frames[index + 1].landmarks);
    
    if (prevCenter && nextCenter) {
      return nextCenter.y - prevCenter.y;
    }
    
    return 0;
  }

  private getBodyCenter(landmarks: MediaPipeLandmark[]): { x: number; y: number } | null {
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (leftHip?.visibility > 0.3 && rightHip?.visibility > 0.3) {
      return {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2
      };
    }
    
    return null;
  }

  private detectPeaksAndValleys(heights: number[], frames: any[], side: 'left' | 'right'): StepDetection[] {
    const detections: StepDetection[] = [];
    
    for (let i = 2; i < heights.length - 2; i++) {
      const prev = heights[i - 1];
      const curr = heights[i];
      const next = heights[i + 1];
      
      if (isNaN(prev) || isNaN(curr) || isNaN(next)) continue;
      
      // 谷（接地）
      if (prev > curr && next > curr && Math.min(prev, next) - curr > 0.05) {
        detections.push({
          frameNumber: frames[i].frameNumber,
          type: 'contact',
          confidence: Math.min(0.9, (Math.min(prev, next) - curr) / 0.2),
          side
        });
      }
      
      // 山（離地）
      if (prev < curr && next < curr && curr - Math.max(prev, next) > 0.05) {
        detections.push({
          frameNumber: frames[i].frameNumber,
          type: 'toeOff',
          confidence: Math.min(0.9, (curr - Math.max(prev, next)) / 0.2),
          side
        });
      }
    }
    
    return detections;
  }
}

export default HighAccuracyStepDetector;