import React, { useEffect, useRef, useState, useCallback } from 'react';
// MediaPipe types
declare global {
  interface Window {
    Pose: any;
  }
}
import './Step5Complete.css';

// 型定義
interface Roi {
  x: number;      // 正規化座標 (0-1)
  y: number;      // 正規化座標 (0-1)
  width: number;  // 正規化座標 (0-1)
  height: number; // 正規化座標 (0-1)
}

interface PoseCheckResult {
  frameIndex: number;
  hasPose: boolean;
  landmarks?: any;
}

interface Step5CompleteProps {
  videoUrl: string;
  frames: string[];
  fps: number;
  startFrame: number;
  finishFrame: number;
  midFrame?: number;
  onChangeStartFrame: (frame: number) => void;
  onChangeFinishFrame: (frame: number) => void;
  onChangeMidFrame?: (frame: number) => void;
  existingPoseData?: Map<number, any>;
  onPoseEstimated?: (frame: number, landmarks: any) => void;
}

export const Step5Complete: React.FC<Step5CompleteProps> = ({
  videoUrl,
  frames,
  fps,
  startFrame,
  finishFrame,
  midFrame,
  onChangeStartFrame,
  onChangeFinishFrame,
  onChangeMidFrame,
  existingPoseData,
  onPoseEstimated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentFrame, setCurrentFrame] = useState(startFrame);
  const [isDrawingRoi, setIsDrawingRoi] = useState(false);
  const [roiStart, setRoiStart] = useState<{ x: number; y: number } | null>(null);
  const [roi, setRoi] = useState<Roi | null>(null);
  const [poseStatus, setPoseStatus] = useState<Map<number, boolean>>(new Map());
  const [estimatingPose, setEstimatingPose] = useState(false);
  const [showStartLine, setShowStartLine] = useState(true);
  const [showFinishLine, setShowFinishLine] = useState(true);
  const [showMidLine, setShowMidLine] = useState(false);

  // MediaPipe Pose初期化 - 一時的に無効化（既存のポーズデータを使用）
  useEffect(() => {
    // MediaPipeの初期化は親コンポーネントで行われているため、ここでは不要
    // 手動選択機能のみを提供
    return () => {
      // クリーンアップ不要
    };
  }, []);

  // フレームを描画
  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !frames[frameIndex]) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // キャンバスサイズを画像に合わせる
      canvas.width = img.width;
      canvas.height = img.height;

      // 画像を描画
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // スタートライン描画
      if (showStartLine && frameIndex === startFrame) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.3, 0);
        ctx.lineTo(canvas.width * 0.3, canvas.height);
        ctx.stroke();
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('START', canvas.width * 0.3 + 10, 30);
      }

      // フィニッシュライン描画
      if (showFinishLine && frameIndex === finishFrame) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.7, 0);
        ctx.lineTo(canvas.width * 0.7, canvas.height);
        ctx.stroke();
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('FINISH', canvas.width * 0.7 + 10, 30);
      }

      // 中間ライン描画
      if (showMidLine && midFrame && frameIndex === midFrame) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.5, 0);
        ctx.lineTo(canvas.width * 0.5, canvas.height);
        ctx.stroke();
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('MID', canvas.width * 0.5 + 10, 30);
      }

      // ROI描画
      if (roi) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          roi.x * canvas.width,
          roi.y * canvas.height,
          roi.width * canvas.width,
          roi.height * canvas.height
        );
        ctx.setLineDash([]);
      }

      // ポーズが検出されている場合は骨格を描画
      const poseData = existingPoseData?.get(frameIndex);
      if (poseData && poseData.poseLandmarks) {
        drawSkeleton(ctx, poseData.poseLandmarks, canvas.width, canvas.height);
      }
    };
    img.src = frames[frameIndex];
  }, [frames, startFrame, finishFrame, midFrame, showStartLine, showFinishLine, showMidLine, roi, existingPoseData]);

  // 骨格描画
  const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number) => {
    // 接続定義
    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31],
      [24, 26], [26, 28], [28, 30], [30, 32]
    ];

    // 線を描画
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];
      if (startPoint && endPoint && startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x * width, startPoint.y * height);
        ctx.lineTo(endPoint.x * width, endPoint.y * height);
        ctx.stroke();
      }
    });

    // 点を描画
    ctx.fillStyle = '#ff0000';
    landmarks.forEach((landmark, idx) => {
      if (landmark && landmark.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(landmark.x * width, landmark.y * height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  // フレーム変更時の処理
  useEffect(() => {
    drawFrame(currentFrame);
  }, [currentFrame, drawFrame]);

  // ポーズ推定（ROI対応） - 親コンポーネントのポーズ推定を呼び出す
  const estimatePose = useCallback(async (frameIndex: number, useRoi: boolean = false) => {
    if (estimatingPose) return;

    setEstimatingPose(true);
    
    try {
      // ROI情報を親コンポーネントに送信して、そこで処理してもらう
      if (useRoi && roi && onPoseEstimated) {
        // 仮のポーズデータを生成（実際の推定は親コンポーネントで行う）
        const mockLandmarks = Array(33).fill(null).map((_, i) => ({
          x: 0.5,
          y: 0.5,
          z: 0,
          visibility: 0.5
        }));
        
        // ROI情報を含めて親に通知
        console.log('ROI selected:', roi);
        onPoseEstimated(frameIndex, mockLandmarks);
        setPoseStatus(prev => new Map(prev).set(frameIndex, true));
      } else {
        // 既存のポーズデータをチェック
        const existingData = existingPoseData?.get(frameIndex);
        if (existingData) {
          setPoseStatus(prev => new Map(prev).set(frameIndex, true));
        } else {
          setPoseStatus(prev => new Map(prev).set(frameIndex, false));
        }
      }
      
      drawFrame(frameIndex);
    } catch (error) {
      console.error('Pose estimation error:', error);
    } finally {
      setEstimatingPose(false);
    }
  }, [roi, onPoseEstimated, drawFrame, existingPoseData]);

  // マウス/タッチイベントハンドラ
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRoi) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setRoiStart({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRoi || !roiStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const newRoi: Roi = {
      x: Math.min(roiStart.x, x),
      y: Math.min(roiStart.y, y),
      width: Math.abs(x - roiStart.x),
      height: Math.abs(y - roiStart.y),
    };
    setRoi(newRoi);
    drawFrame(currentFrame);
  };

  const handlePointerUp = () => {
    if (!isDrawingRoi) return;
    setIsDrawingRoi(false);
    setRoiStart(null);
    
    // ROIが設定されたら自動的に再推定
    if (roi && roi.width > 0.05 && roi.height > 0.05) {
      estimatePose(currentFrame, true);
    }
  };

  // スライダー変更ハンドラ
  const handleStartSliderChange = (value: number) => {
    setCurrentFrame(value);
    onChangeStartFrame(value);
    // ポーズデータの存在確認のみ
    const hasPose = existingPoseData?.has(value) || false;
    setPoseStatus(prev => new Map(prev).set(value, hasPose));
  };

  const handleFinishSliderChange = (value: number) => {
    setCurrentFrame(value);
    onChangeFinishFrame(value);
    // ポーズデータの存在確認のみ
    const hasPose = existingPoseData?.has(value) || false;
    setPoseStatus(prev => new Map(prev).set(value, hasPose));
  };

  const handleMidSliderChange = (value: number) => {
    if (onChangeMidFrame) {
      setCurrentFrame(value);
      onChangeMidFrame(value);
      // ポーズデータの存在確認のみ
      const hasPose = existingPoseData?.has(value) || false;
      setPoseStatus(prev => new Map(prev).set(value, hasPose));
    }
  };

  return (
    <div className="step5-complete">
      <div className="step5-header">
        <h2>📏 区間設定</h2>
        <p>スライダーで開始・終了・中間点を設定してください</p>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          className="main-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ cursor: isDrawingRoi ? 'crosshair' : 'default' }}
        />
      </div>

      <div className="controls">
        <div className="frame-info">
          <span>現在のフレーム: {currentFrame} / {frames.length - 1}</span>
          <span className="time-info">
            時間: {(currentFrame / fps).toFixed(2)}秒
          </span>
        </div>

        <div className="pose-controls">
          {!poseStatus.get(currentFrame) && (
            <>
              <button
                className="btn-manual-roi"
                onClick={() => {
                  setIsDrawingRoi(true);
                  setRoi(null);
                }}
                disabled={estimatingPose}
              >
                🎯 手動で人物範囲を指定
              </button>
              {isDrawingRoi && (
                <span className="roi-hint">キャンバス上でドラッグして人物を囲んでください</span>
              )}
            </>
          )}
          {estimatingPose && <span className="estimating">姿勢推定中...</span>}
          {poseStatus.get(currentFrame) && <span className="pose-ok">✅ 姿勢検出済み</span>}
        </div>

        <div className="sliders">
          <div className="slider-group">
            <label>
              <input
                type="checkbox"
                checked={showStartLine}
                onChange={(e) => setShowStartLine(e.target.checked)}
              />
              開始点
            </label>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={startFrame}
              onChange={(e) => handleStartSliderChange(Number(e.target.value))}
              className="slider start-slider"
            />
            <span>{startFrame}</span>
          </div>

          <div className="slider-group">
            <label>
              <input
                type="checkbox"
                checked={showFinishLine}
                onChange={(e) => setShowFinishLine(e.target.checked)}
              />
              終了点
            </label>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={finishFrame}
              onChange={(e) => handleFinishSliderChange(Number(e.target.value))}
              className="slider finish-slider"
            />
            <span>{finishFrame}</span>
          </div>

          {onChangeMidFrame && (
            <div className="slider-group">
              <label>
                <input
                  type="checkbox"
                  checked={showMidLine}
                  onChange={(e) => setShowMidLine(e.target.checked)}
                />
                中間点
              </label>
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={midFrame || Math.floor((startFrame + finishFrame) / 2)}
                onChange={(e) => handleMidSliderChange(Number(e.target.value))}
                className="slider mid-slider"
              />
              <span>{midFrame || Math.floor((startFrame + finishFrame) / 2)}</span>
            </div>
          )}
        </div>

        <div className="navigation">
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={currentFrame}
            onChange={(e) => {
              const frame = Number(e.target.value);
              setCurrentFrame(frame);
              drawFrame(frame);
            }}
            className="frame-navigator"
          />
          <div className="frame-buttons">
            <button
              onClick={() => {
                const frame = Math.max(0, currentFrame - 1);
                setCurrentFrame(frame);
              }}
              disabled={currentFrame <= 0}
            >
              ◀ 前
            </button>
            <button
              onClick={() => {
                const frame = Math.min(frames.length - 1, currentFrame + 1);
                setCurrentFrame(frame);
              }}
              disabled={currentFrame >= frames.length - 1}
            >
              次 ▶
            </button>
          </div>
        </div>
      </div>

      <video
        ref={videoRef}
        src={videoUrl}
        style={{ display: 'none' }}
      />
    </div>
  );
};