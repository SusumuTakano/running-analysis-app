/**
 * MediaPipe Pose Estimation Utility
 * 
 * マルチカメラ走行分析用の姿勢推定ユーティリティ
 * 既存の runPoseEstimation を独立した関数として抽出
 */

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface FramePoseData {
  landmarks: PoseLandmark[];
  worldLandmarks?: PoseLandmark[];
  visibility: number;
}

export interface PoseEstimationOptions {
  modelComplexity?: number;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
  staticImageMode?: boolean;
  smoothLandmarks?: boolean;
  onProgress?: (progress: number) => void;
  onStatus?: (status: string) => void;
}

/**
 * フレーム配列に対して MediaPipe Pose 推定を実行
 * 
 * @param frames - ImageData の配列
 * @param options - オプション設定
 * @returns Promise<(FramePoseData | null)[]> - 各フレームの姿勢データ
 */
export async function runPoseEstimationOnFrames(
  frames: ImageData[],
  options: PoseEstimationOptions = {}
): Promise<(FramePoseData | null)[]> {
  if (!frames.length) {
    throw new Error("先にフレーム抽出を実行してください。");
  }

  const {
    onProgress = () => {},
    onStatus = () => {},
  } = options;

  try {
    // MediaPipeの存在をチェック
    console.log('🔍 Checking MediaPipe availability...');
    console.log('window.Pose:', typeof (window as any).Pose);
    console.log('User Agent:', navigator.userAgent);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let Pose: any = (window as any).Pose;

    if (!Pose) {
      // iPadでMediaPipeが読み込まれていない場合の詳細エラー
      console.error('❌ MediaPipe Pose not found!');
      console.error('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('pose') || k.toLowerCase().includes('media')));
      
      // MediaPipeの手動読み込みを試みる
      if (/iPad|iPhone/i.test(navigator.userAgent)) {
        console.log('🔄 Attempting to reload MediaPipe for iOS...');
        
        // スクリプトの再読み込みを試みる
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.min.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => {
            console.log('✅ MediaPipe Pose script reloaded');
            resolve(true);
          };
          script.onerror = (e) => {
            console.error('❌ Failed to reload MediaPipe:', e);
            reject(e);
          };
          document.head.appendChild(script);
        });
        
        // 少し待ってから再チェック
        await new Promise(resolve => setTimeout(resolve, 500));
        Pose = (window as any).Pose;
        
        if (!Pose) {
          throw new Error("MediaPipe PoseライブラリがiPadで読み込めませんでした。ページをリロードしてください。");
        }
      } else {
        throw new Error("MediaPipe Poseライブラリが読み込まれていません。");
      }
    }

    // Poseインスタンスを作成
    console.log('🎯 Creating Pose instance...');
    const pose = new Pose({
      locateFile: (file: string) => {
        const url = `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
        console.log(`📁 Loading MediaPipe file: ${file} from ${url}`);
        return url;
      },
    });

    // デバイスに応じた設定
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isIPad = /iPad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // デバイスごとの最適化設定
    let modelComplexity = options.modelComplexity ?? 2; // 高精度モデルをデフォルトに
    let minDetectionConfidence = options.minDetectionConfidence ?? 0.1;
    let minTrackingConfidence = options.minTrackingConfidence ?? 0.1;
    let staticImageMode = options.staticImageMode ?? false;
    let smoothLandmarks = options.smoothLandmarks ?? true;
    
    if (isIPad) {
      console.log('📱 iPad detected - applying optimized settings');
      modelComplexity = options.modelComplexity ?? 1; // 中精度モデル（iPadはメモリ制限あり）
      minDetectionConfidence = options.minDetectionConfidence ?? 0.05;
      minTrackingConfidence = options.minTrackingConfidence ?? 0.05;
      staticImageMode = false; // ストリーミングモードで連続性を保つ
      smoothLandmarks = true; // スムージングを有効化
    } else if (isMobile) {
      console.log('📱 Mobile device detected - optimized settings');
      modelComplexity = options.modelComplexity ?? 1;
      minDetectionConfidence = options.minDetectionConfidence ?? 0.05;
      minTrackingConfidence = options.minTrackingConfidence ?? 0.05;
    } else {
      console.log('💻 Desktop detected - high accuracy settings');
      modelComplexity = options.modelComplexity ?? 2;
      minDetectionConfidence = options.minDetectionConfidence ?? 0.05;
      minTrackingConfidence = options.minTrackingConfidence ?? 0.05;
    }
    
    console.log(`🔧 Setting options: modelComplexity=${modelComplexity}, detection=${minDetectionConfidence}, tracking=${minTrackingConfidence}`);
    
    pose.setOptions({
      modelComplexity,
      smoothLandmarks,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence,
      minTrackingConfidence,
      selfieMode: false,
      staticImageMode,
    });
    
    console.log(`🚀 Pose estimation config: mobile=${isMobile}, iOS=${isIOS}, iPad=${isIPad}, modelComplexity=${modelComplexity}`);
    
    // iPadでは初期化を待つ
    if (isIPad) {
      console.log('⏳ Waiting for MediaPipe initialization on iPad...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const results: (FramePoseData | null)[] = [];
    const totalFrames = frames.length;
    
    // メモリ効率のため、再利用可能なcanvasを作成
    const tempCanvas = document.createElement("canvas");
    const firstFrame = frames[0];
    tempCanvas.width = firstFrame.width;
    tempCanvas.height = firstFrame.height;
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
    
    if (!tempCtx) {
      throw new Error("Canvas context の作成に失敗しました");
    }

    // MediaPipe入力用に縮小したキャンバスを用意
    const maxPoseWidth = isIPad ? 540 : 960;
    const poseScale = Math.min(1, maxPoseWidth / tempCanvas.width);
    const poseCanvas = document.createElement("canvas");
    poseCanvas.width = Math.max(1, Math.round(tempCanvas.width * poseScale));
    poseCanvas.height = Math.max(1, Math.round(tempCanvas.height * poseScale));
    const poseCtx = poseCanvas.getContext("2d", { willReadFrequently: true });
    if (!poseCtx) {
      throw new Error("Pose canvas context の作成に失敗しました");
    }

    const drawPoseInput = () => {
      poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
      poseCtx.drawImage(
        tempCanvas,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height,
        0,
        0,
        poseCanvas.width,
        poseCanvas.height
      );
    };

    // バッチ処理のサイズ（メモリ解放のタイミング）
    const batchSize = isIPad ? 3 : (isMobile ? 5 : 10); // デスクトップも10フレームに削減
    const timeoutDuration = 30000; // 全デバイス共通で30秒に延長（593フレーム対応）

    // 最初のフレームで動作確認
    if (totalFrames > 0) {
      console.log('🧪 Testing pose estimation on first frame...');
      tempCtx.putImageData(frames[0], 0, 0);
      
      try {
        const testResult = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error('❌ Test frame timeout');
            reject(new Error("Test timeout"));
          }, isIPad ? 10000 : 5000);
          
          pose.onResults((r: any) => {
            clearTimeout(timeout);
            console.log('✅ Test frame processed:', r.poseLandmarks ? 'Landmarks found' : 'No landmarks');
            resolve(r);
          });
          
          drawPoseInput();
          pose.send({ image: poseCanvas }).catch((e: any) => {
            console.error('❌ Test frame send error:', e);
            reject(e);
          });
        });
        
        if (!testResult.poseLandmarks) {
          console.warn('⚠️ First frame test: No landmarks detected');
        }
      } catch (testError) {
        console.error('❌ Test frame failed:', testError);
        // テスト失敗でも処理は続行
      }
    }

    onStatus("姿勢推定を実行中...");

    // 🔧 FIX: onResults を1回だけ設定（コールバック競合を防ぐ）
    let currentResolve: ((value: any) => void) | null = null;
    let currentReject: ((reason?: any) => void) | null = null;

    pose.onResults((result: any) => {
      if (currentResolve) {
        currentResolve(result);
        currentResolve = null;
        currentReject = null;
      }
    });

    // フレームごとに処理
    for (let i = 0; i < totalFrames; i++) {
      const frame = frames[i];
      tempCtx.putImageData(frame, 0, 0);

      try {
        const result = await new Promise<any>((resolve, reject) => {
          currentResolve = resolve;
          currentReject = reject;
          
          const timeout = setTimeout(() => {
            if (currentReject) {
              console.error(`❌ Frame ${i} timeout`);
              currentReject(new Error(`Frame ${i} timeout`));
              currentResolve = null;
              currentReject = null;
            }
          }, timeoutDuration);
          
          drawPoseInput();
          pose.send({ image: poseCanvas }).catch((e: any) => {
            clearTimeout(timeout);
            if (currentReject) {
              console.error(`❌ Frame ${i} send error:`, e);
              currentReject(e);
              currentResolve = null;
              currentReject = null;
            }
          });
          
          // 成功時にタイムアウトをクリア
          const originalResolve = resolve;
          currentResolve = (r: any) => {
            clearTimeout(timeout);
            originalResolve(r);
          };
        });

        if (result.poseLandmarks) {
          const normalizedLandmarks: PoseLandmark[] = result.poseLandmarks.map((lm: any) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z ?? 0,
            visibility: lm.visibility ?? 0,
          }));

          const avgVisibility = normalizedLandmarks.reduce((sum, lm) => sum + lm.visibility, 0) / normalizedLandmarks.length;

          results.push({
            landmarks: normalizedLandmarks,
            worldLandmarks: result.poseWorldLandmarks,
            visibility: avgVisibility,
          });
        } else {
          results.push(null);
        }

        onProgress(Math.round(((i + 1) / totalFrames) * 100));
      } catch (error) {
        console.error(`❌ Frame ${i} processing failed:`, error);
        results.push(null);
      }

      // バッチごとにメモリ解放（待機時間を延長）
      if ((i + 1) % batchSize === 0) {
        console.log(`📦 Batch ${Math.floor((i + 1) / batchSize)} complete (${i + 1}/${totalFrames})`);
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms待機
      }
    }

    console.log(`✅ Pose estimation complete: ${results.filter(r => r !== null).length}/${totalFrames} frames with landmarks`);
    pose.close();

    return results;
  } catch (error) {
    console.error('❌ Pose estimation error:', error);
    throw error;
  }
}
