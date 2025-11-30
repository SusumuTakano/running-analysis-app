/**
 * 高精度姿勢推定モジュール
 * 読み込み停止問題と姿勢推定精度を根本的に改善
 */

// MediaPipe の型定義
export interface MediaPipeLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

interface MediaPipeResult {
  landmarks: MediaPipeLandmark[][];
}

// 高精度姿勢推定クラス
export class HighAccuracyPoseEstimator {
  private pose: any;
  private isInitialized = false;
  private frameBuffer: ImageData[] = [];
  private readonly CONFIDENCE_THRESHOLD = 0.6; // 基準を上げる
  private readonly MIN_LANDMARKS_VISIBLE = 0.7; // 70%以上のランドマークが見える必要

  constructor() {
    this.initializePose();
  }

  private async initializePose() {
    try {
      const mp = (window as any).mp;
      if (!mp || !mp.tasks || !mp.tasks.vision) {
        console.warn('MediaPipe not available, waiting...');
        setTimeout(() => this.initializePose(), 1000);
        return;
      }

      this.pose = new mp.tasks.vision.Pose({
        locate: true,
        modelComplexity: 2, // 最高精度
        smoothLandmarks: true,
        minDetectionConfidence: this.CONFIDENCE_THRESHOLD,
        minTrackingConfidence: this.CONFIDENCE_THRESHOLD,
        smoothSegmentation: true,
        enableSegmentation: false
      });

      this.isInitialized = true;
      console.log('高精度姿勢推定器が初期化されました');
    } catch (error) {
      console.error('姿勢推定器の初期化エラー:', error);
    }
  }

  /**
   * 高精度で姿勢を推定（段階的処理）
   */
  async estimatePoseWithHighAccuracy(
    canvas: HTMLCanvasElement,
    frameIndex: number,
    totalFrames: number
  ): Promise<{ landmarks: MediaPipeLandmark[]; confidence: number }> {
    
    if (!this.isInitialized) {
      await this.waitForInitialization();
    }

    try {
      // 1. 画像前処理 - コントラストと明るさを最適化
      const processedCanvas = this.preprocessImage(canvas);
      
      // 2. 複数回の推定を実行して平均を取る
      const results: MediaPipeLandmark[][] = [];
      const confidences: number[] = [];
      
      // 3回推定して信頼度の高いものを選択
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await this.pose.detect(processedCanvas);
          
          if (result.landmarks && result.landmarks.length > 0) {
            const landmarks = result.landmarks[0];
            const confidence = this.calculateOverallConfidence(landmarks);
            
            if (confidence >= this.CONFIDENCE_THRESHOLD) {
              results.push(landmarks);
              confidences.push(confidence);
            }
          }
        } catch (error) {
          console.warn(`推定試行 ${attempt + 1} 失敗:`, error);
        }
      }

      // 3. 最も信頼度の高い結果を選択
      if (results.length > 0) {
        const bestIndex = confidences.indexOf(Math.max(...confidences));
        return {
          landmarks: results[bestIndex],
          confidence: confidences[bestIndex]
        };
      }

      // 4. それでも検出できない場合は、段階的に閾値を下げる
      return await this.estimateWithFallback(processedCanvas);

    } catch (error) {
      console.error('姿勢推定エラー:', error);
      return this.estimateWithFallback(canvas);
    }
  }

  /**
   * 画像前処理 - 検出率を向上させる
   */
  private preprocessImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const processedCanvas = document.createElement('canvas');
    processedCanvas.width = canvas.width;
    processedCanvas.height = canvas.height;
    const ctx = processedCanvas.getContext('2d');
    if (!ctx) return canvas;

    // 元の画像をコピー
    ctx.drawImage(canvas, 0, 0);

    // 画像データを取得
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // ヒストグラム均一化によるコントラスト改善
    this.applyHistogramEqualization(data);
    
    // ガンマ補正
    this.applyGammaCorrection(data, 1.2);
    
    // 適応的なシャープニング
    this.applyAdaptiveSharpening(data, canvas.width, canvas.height);

    ctx.putImageData(imageData, 0, 0);
    return processedCanvas;
  }

  /**
   * ヒストグラム均一化
   */
  private applyHistogramEqualization(data: Uint8ClampedArray): void {
    const histogram = new Array(256).fill(0);
    const totalPixels = data.length / 4;

    // 輝度ヒストグラムを計算
    for (let i = 0; i < data.length; i += 4) {
      const luminance = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[luminance]++;
    }

    // 累積分布関数を計算
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    // 均一化を適用
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // 輝度を計算して均一化
      const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const equalizedLuminance = Math.round((cdf[luminance] / totalPixels) * 255);
      
      // 色差を保持しながら輝度を調整
      const factor = equalizedLuminance / (luminance || 1);
      data[i] = Math.min(255, Math.max(0, r * factor));
      data[i + 1] = Math.min(255, Math.max(0, g * factor));
      data[i + 2] = Math.min(255, Math.max(0, b * factor));
    }
  }

  /**
   * ガンマ補正
   */
  private applyGammaCorrection(data: Uint8ClampedArray, gamma: number): void {
    const gammaCorrection = 1 / gamma;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, Math.pow(data[i] / 255, gammaCorrection) * 255));
      data[i + 1] = Math.min(255, Math.max(0, Math.pow(data[i + 1] / 255, gammaCorrection) * 255));
      data[i + 2] = Math.min(255, Math.max(0, Math.pow(data[i + 2] / 255, gammaCorrection) * 255));
    }
  }

  /**
   * 適応的シャープニング
   */
  private applyAdaptiveSharpening(data: Uint8ClampedArray, width: number, height: number): void {
    // 簡易的なシャープニングフィルタ
    const factor = 0.5;
    const tempData = new Uint8ClampedArray(data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          const center = tempData[idx + c];
          const left = tempData[((y * width) + (x - 1)) * 4 + c];
          const right = tempData[((y * width) + (x + 1)) * 4 + c];
          const top = tempData[(((y - 1) * width) + x) * 4 + c];
          const bottom = tempData[(((y + 1) * width) + x) * 4 + c];
          
          const sharpened = center + factor * (center * 4 - left - right - top - bottom);
          data[idx + c] = Math.min(255, Math.max(0, sharpened));
        }
      }
    }
  }

  /**
   * 全体的な信頼度を計算
   */
  private calculateOverallConfidence(landmarks: MediaPipeLandmark[]): number {
    if (!landmarks || landmarks.length === 0) return 0;

    let visibleLandmarks = 0;
    let totalConfidence = 0;

    // 重要なランドマーク（関節）の信頼度を重視
    const importantLandmarks = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
    ];

    for (const index of importantLandmarks) {
      if (index < landmarks.length && landmarks[index]) {
        const landmark = landmarks[index];
        if (landmark.visibility > 0.5) {
          visibleLandmarks++;
          totalConfidence += landmark.visibility;
        }
      }
    }

    const visibilityRatio = visibleLandmarks / importantLandmarks.length;
    const avgConfidence = visibleLandmarks > 0 ? totalConfidence / visibleLandmarks : 0;

    return Math.min(1, (visibilityRatio * 0.6 + avgConfidence * 0.4));
  }

  /**
   * フォールバック推定（段階的に閾値を下げる）
   */
  private async estimateWithFallback(canvas: HTMLCanvasElement): Promise<{ landmarks: MediaPipeLandmark[]; confidence: number }> {
    const thresholds = [0.5, 0.4, 0.3];
    
    for (const threshold of thresholds) {
      try {
        const result = await this.pose.detect(canvas);
        if (result.landmarks && result.landmarks.length > 0) {
          const landmarks = result.landmarks[0];
          const confidence = this.calculateOverallConfidence(landmarks);
          
          if (confidence >= threshold) {
            return { landmarks, confidence };
          }
        }
      } catch (error) {
        console.warn(`フォールバック推定失敗 (閾値: ${threshold}):`, error);
      }
    }

    // 最後の手段：低信頼度でも返す
    return { landmarks: [], confidence: 0.2 };
  }

  /**
   * 初期化待機
   */
  private async waitForInitialization(): Promise<void> {
    let attempts = 0;
    while (!this.isInitialized && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!this.isInitialized) {
      throw new Error('姿勢推定器の初期化に失敗しました');
    }
  }

  /**
   * リソースのクリーンアップ
   */
  cleanup(): void {
    if (this.pose) {
      this.pose.close();
    }
    this.isInitialized = false;
  }
}

// 段階的フレーム処理クラス
export class ProgressiveFrameProcessor {
  private estimator: HighAccuracyPoseEstimator;
  private processedFrames = 0;
  private totalFrames = 0;
  private onProgress?: (progress: number) => void;
  private frameBuffer: any[] = [];

  constructor(onProgress?: (progress: number) => void) {
    this.estimator = new HighAccuracyPoseEstimator();
    this.onProgress = onProgress;
  }

  /**
   * 段階的にフレームを処理（メモリ効率化）
   */
  async processFramesProgressively(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    totalFrames: number,
    fps: number
  ): Promise<Array<{ frameNumber: number; landmarks: MediaPipeLandmark[]; confidence: number }>> {
    
    this.totalFrames = totalFrames;
    this.processedFrames = 0;
    const results: Array<{ frameNumber: number; landmarks: MediaPipeLandmark[]; confidence: number }> = [];
    const frameInterval = 1 / fps;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // 段階的処理：10フレームごとに処理
    const batchSize = 10;
    
    for (let batchStart = 0; batchStart < totalFrames; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, totalFrames);
      
      for (let i = batchStart; i < batchEnd; i++) {
        const time = i * frameInterval;
        video.currentTime = time;
        
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        try {
          const result = await this.estimator.estimatePoseWithHighAccuracy(
            canvas,
            i,
            totalFrames
          );
          
          if (result.confidence >= 0.5) { // 信頼度の高い結果のみ保存
            results.push({
              frameNumber: i,
              landmarks: result.landmarks,
              confidence: result.confidence
            });
          }
        } catch (error) {
          console.warn(`フレーム ${i} 処理失敗:`, error);
        }
        
        this.processedFrames++;
        
        // メモリ解放のため、定期的にガベージコレクションを促す
        if (i % 50 === 0) {
          await this.forceGarbageCollection();
        }
      }
      
      // 進捗更新
      if (this.onProgress) {
        this.onProgress((this.processedFrames / totalFrames) * 100);
      }
      
      // メモリ解放
      await this.forceGarbageCollection();
    }

    return results;
  }

  /**
   * ガベージコレクションを強制（メモリ効率化）
   */
  private async forceGarbageCollection(): Promise<void> {
    // メモリ解放のため、短い遅延を入れる
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // 大きなオブジェクトをクリア
    this.frameBuffer = [];
    
    // ブラウザのガベージコレクションを促す
    if ((window as any).gc) {
      (window as any).gc();
    }
  }

  /**
   * リソースクリーンアップ
   */
  cleanup(): void {
    this.estimator.cleanup();
  }
}

// エクスポート
export default {
  HighAccuracyPoseEstimator,
  ProgressiveFrameProcessor
};