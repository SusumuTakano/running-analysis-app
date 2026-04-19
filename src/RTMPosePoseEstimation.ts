/**
 * RTMPose姿勢推定モジュール（MediaPipe互換）
 *
 * サーバーサイドのRTMPose-xを呼び出し、
 * MediaPipeLandmark形式で結果を返す。
 * 既存のStepDetection/Evaluationコードがそのまま動く。
 */

export interface MediaPipeLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

const API_URL = import.meta.env.VITE_RTMPOSE_API_URL || 'http://localhost:8765';

/**
 * RTMPoseを使った高精度姿勢推定器（MediaPipe互換インターフェース）
 */
export class HighAccuracyPoseEstimator {
  private isInitialized = false;
  private serverAvailable = false;

  constructor() {
    this.checkServer();
  }

  private async checkServer() {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) {
        this.serverAvailable = true;
        this.isInitialized = true;
        console.log('RTMPose APIサーバー接続成功');
      }
    } catch {
      console.warn('RTMPose APIサーバーに接続できません。起動してください: python api/pose_server.py');
    }
  }

  /**
   * 高精度で姿勢を推定（MediaPipe互換インターフェース）
   * canvas → サーバーに送信 → MediaPipeLandmark形式で返す
   */
  async estimatePoseWithHighAccuracy(
    canvas: HTMLCanvasElement,
    _frameIndex: number,
    _totalFrames: number
  ): Promise<{ landmarks: MediaPipeLandmark[]; confidence: number }> {

    if (!this.serverAvailable) {
      await this.waitForServer();
    }

    try {
      // Canvas → Blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas to blob failed'));
        }, 'image/jpeg', 0.95);
      });

      // Send to API
      const formData = new FormData();
      formData.append('frame', blob, 'frame.jpg');

      const res = await fetch(`${API_URL}/process_frame`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      return {
        landmarks: data.landmarks,
        confidence: data.confidence,
      };
    } catch (error) {
      console.error('RTMPose推定エラー:', error);
      return { landmarks: [], confidence: 0 };
    }
  }

  private async waitForServer(): Promise<void> {
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`${API_URL}/health`);
        if (res.ok) {
          this.serverAvailable = true;
          this.isInitialized = true;
          return;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('RTMPose APIサーバーに接続できません');
  }

  cleanup(): void {
    this.isInitialized = false;
  }
}

/**
 * 動画一括処理（サーバーサイドで全フレーム処理）
 * MediaPipe互換のProgressiveFrameProcessorインターフェース
 */
export class ProgressiveFrameProcessor {
  private onProgress?: (progress: number) => void;

  constructor(onProgress?: (progress: number) => void) {
    this.onProgress = onProgress;
  }

  /**
   * 動画ファイルをサーバーに送って一括処理（高速）
   */
  async processVideoFile(
    videoFile: File,
    roi?: { x: number; y: number; width: number; height: number }
  ): Promise<Array<{ frameNumber: number; landmarks: MediaPipeLandmark[]; confidence: number }>> {

    const formData = new FormData();
    formData.append('video', videoFile);
    if (roi) {
      formData.append('roi', `${roi.x},${roi.y},${roi.width},${roi.height}`);
    }

    // Start progress polling
    const progressInterval = setInterval(() => {
      // サーバーから進捗を取得する場合はここで
    }, 1000);

    try {
      const res = await fetch(`${API_URL}/process_video`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `API error: ${res.status}`);
      }

      const data = await res.json();

      // Convert to existing format
      const results: Array<{ frameNumber: number; landmarks: MediaPipeLandmark[]; confidence: number }> = [];

      for (let i = 0; i < data.landmarks.length; i++) {
        const landmarks = data.landmarks[i];
        const confidence = landmarks.reduce(
          (sum: number, lm: MediaPipeLandmark) => sum + lm.visibility, 0
        ) / landmarks.length;

        if (confidence > 0.3) {
          results.push({
            frameNumber: i,
            landmarks,
            confidence,
          });
        }

        if (this.onProgress && i % 10 === 0) {
          this.onProgress((i / data.landmarks.length) * 100);
        }
      }

      if (this.onProgress) {
        this.onProgress(100);
      }

      console.log(`RTMPose: ${results.length}/${data.totalFrames} frames processed`);
      return results;

    } finally {
      clearInterval(progressInterval);
    }
  }

  /**
   * フレームごとの段階的処理（MediaPipe互換インターフェース）
   * 後方互換性のために残す — 内部でprocess_frameを呼ぶ
   */
  async processFramesProgressively(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    totalFrames: number,
    fps: number
  ): Promise<Array<{ frameNumber: number; landmarks: MediaPipeLandmark[]; confidence: number }>> {

    const estimator = new HighAccuracyPoseEstimator();
    const results: Array<{ frameNumber: number; landmarks: MediaPipeLandmark[]; confidence: number }> = [];
    const frameInterval = 1 / fps;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    for (let i = 0; i < totalFrames; i++) {
      video.currentTime = i * frameInterval;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const result = await estimator.estimatePoseWithHighAccuracy(canvas, i, totalFrames);

      if (result.confidence >= 0.3) {
        results.push({
          frameNumber: i,
          landmarks: result.landmarks,
          confidence: result.confidence,
        });
      }

      if (this.onProgress && i % 5 === 0) {
        this.onProgress((i / totalFrames) * 100);
      }
    }

    estimator.cleanup();
    return results;
  }

  cleanup(): void {}
}

export default {
  HighAccuracyPoseEstimator,
  ProgressiveFrameProcessor,
};
