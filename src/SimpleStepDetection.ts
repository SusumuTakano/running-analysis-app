// 簡素化された歩行検出アルゴリズム
// 複雑な処理を排除し、基本的なつま先の上下動に焦点を当てる

export interface SimpleStep {
  contactFrame: number;
  toeOffFrame: number;
}

export interface ToeHeightData {
  frame: number;
  height: number;
  velocity: number;
}

// 軽量フレームデータ（圧縮済みランドマーク）
export interface LightFrameData {
  frameNumber: number;
  timestamp: number;
  landmarks: Float32Array;
}

// ランドマークの展開関数
function decompressLandmarks(compressed: Float32Array): Array<{ x: number; y: number; z: number; visibility: number }> {
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
}

/**
 * 簡素化されたつま先軌道分析
 * 主な改善点：
 * 1. 正確なつま先ランドマークを使用
 * 2. 適応的閾値を使用
 * 3. 明確な極値検出
 */
export function analyzeSimpleToeTrajectory(frames: LightFrameData[]): ToeHeightData[] {
  const toeHeights: ToeHeightData[] = [];
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const landmarks = decompressLandmarks(frame.landmarks);
    
    // 正確なつま先ランドマーク（LEFT_FOOT_INDEX=31, RIGHT_FOOT_INDEX=32）
    const leftToe = landmarks[31];
    const rightToe = landmarks[32];
    
    let toeY = 0;
    let validPoints = 0;
    
    if (leftToe && leftToe.visibility > 0.3) {
      toeY += leftToe.y;
      validPoints++;
    }
    
    if (rightToe && rightToe.visibility > 0.3) {
      toeY += rightToe.y;
      validPoints++;
    }
    
    if (validPoints > 0) {
      toeY /= validPoints;
    } else {
      // データが欠損している場合は補間
      if (i > 0) {
        toeY = toeHeights[i - 1]?.height || 0;
      } else {
        toeY = 0.5; // デフォルト値
      }
    }
    
    toeHeights.push({
      frame: i,
      height: toeY,
      velocity: 0
    });
  }
  
  // 速度計算（移動平均なし）
  for (let i = 1; i < toeHeights.length - 1; i++) {
    const prev = toeHeights[i - 1].height;
    const curr = toeHeights[i].height;
    const next = toeHeights[i + 1].height;
    
    // 中央差分で速度を計算
    toeHeights[i].velocity = (next - prev) / 2;
  }
  
  return toeHeights;
}

/**
 * 改良された接地・離地検出
 * 主な改善点：
 * 1. 早期ステップの検出を強化
 * 2. 個人差に対応する適応的閾値
 * 3. 明確な極値検出
 */
export function detectSimpleSteps(
  toeHeights: ToeHeightData[]
): SimpleStep[] {
  const steps: SimpleStep[] = [];
  
  if (toeHeights.length < 15) return steps; // 最小データ数を増やす
  
  // 全データの統計量を計算
  const heights = toeHeights.map(t => t.height).filter(h => !isNaN(h));
  if (heights.length === 0) return steps;
  
  const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
  const variance = heights.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / heights.length;
  const stdDev = Math.sqrt(variance);
  
  // 適応的な閾値を設定
  const baseThreshold = stdDev * 0.4;
  const minStepInterval = 8; // 最小ステップ間隔（フレーム数）を増やす
  const minStepTime = 0.2; // 最小ステップ時間（秒）
  
  let lastStepFrame = -minStepInterval;
  let state: 'ground' | 'air' = 'ground';
  let contactCandidate = -1;
  let maxHeightInAir = -Infinity;
  let minHeightInAir = Infinity;
  
  for (let i = 2; i < toeHeights.length - 2; i++) {
    const curr = toeHeights[i];
    const velocity = Math.abs(curr.velocity);
    
    // 状態に基づいた処理
    if (state === 'ground') {
      // 接地状態：空中への遷移を検出
      if (velocity > baseThreshold) {
        // 空中への遷移
        state = 'air';
        maxHeightInAir = curr.height;
        minHeightInAir = curr.height;
      }
    } else if (state === 'air') {
      // 空中状態：最大高さと最小高さを追跡
      maxHeightInAir = Math.max(maxHeightInAir, curr.height);
      minHeightInAir = Math.min(minHeightInAir, curr.height);
      
      // 接地の検出
      if (velocity < baseThreshold * 0.3) {
        // 明確な極値（速度が最小）
        if (contactCandidate === -1 && (i - lastStepFrame) > minStepInterval) {
          contactCandidate = i;
        }
      }
      
      // 着地の確定
      if (contactCandidate !== -1 && velocity < baseThreshold * 0.2) {
        const heightDiff = maxHeightInAir - minHeightInAir;
        
        // 十分な高さの変化があればステップとして認識
        if (heightDiff > stdDev * 0.2) {
          steps.push({
            contactFrame: contactCandidate,
            toeOffFrame: Math.max(0, Math.floor((contactCandidate + i) / 2))
          });
          
          lastStepFrame = i;
          contactCandidate = -1;
          state = 'ground';
        }
      }
    }
  }
  
  // 早期ステップの補正：最初のステップを改善
  if (steps.length > 0 && steps[0].contactFrame < 10) {
    // 最初のステップが早すぎる場合、もう一度検討
    const firstStep = steps[0];
    if (firstStep.contactFrame < 5) {
      // より慎重な検出を試みる
      for (let i = 0; i < Math.min(15, toeHeights.length - 1); i++) {
        const velocity = Math.abs(toeHeights[i].velocity);
        if (velocity > baseThreshold * 0.6) {
          steps[0] = {
            contactFrame: i,
            toeOffFrame: Math.max(0, i + 3)
          };
          break;
        }
      }
    }
  }
  
  return steps;
}

/**
 * 高精度姿勢推定のための前処理
 */
export function preprocessForPoseEstimation(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // 簡単なコントラスト調整のみ
  for (let i = 0; i < data.length; i += 4) {
    // ガンマ補正（明るさ調整）
    const gamma = 0.8;
    data[i] = Math.min(255, Math.pow(data[i] / 255, gamma) * 255);
    data[i + 1] = Math.min(255, Math.pow(data[i + 1] / 255, gamma) * 255);
    data[i + 2] = Math.min(255, Math.pow(data[i + 2] / 255, gamma) * 255);
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * MediaPipe設定（高精度版）
 */
export function getOptimizedPoseConfig(): any {
  return {
    locate: true,
    modelComplexity: 1, // バランスの取れた設定
    smoothLandmarks: true,
    minDetectionConfidence: 0.5, // 検出感度
    minTrackingConfidence: 0.5, // 追跡感度
    smoothSegmentation: false, // メモリ節約
    enableSegmentation: false // メモリ節約
  };
}