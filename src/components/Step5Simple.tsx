import React, { useEffect, useRef, useState } from 'react';
import './Step5Simple.css';

interface Step5SimpleProps {
  frames: string[];
  fps: number;
  startFrame: number;
  finishFrame: number;
  midFrame?: number;
  onChangeStartFrame: (frame: number) => void;
  onChangeFinishFrame: (frame: number) => void;
  onChangeMidFrame?: (frame: number) => void;
  existingPoseData?: Map<number, any>;
  onSelectRoi?: (frame: number, roi: {x: number, y: number, width: number, height: number}) => void;
}

export const Step5Simple: React.FC<Step5SimpleProps> = ({
  frames,
  fps,
  startFrame,
  finishFrame,
  midFrame,
  onChangeStartFrame,
  onChangeFinishFrame,
  onChangeMidFrame,
  existingPoseData,
  onSelectRoi,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState(startFrame);
  const [isSelectingRoi, setIsSelectingRoi] = useState(false);
  const [roiStart, setRoiStart] = useState<{x: number, y: number} | null>(null);
  const [roi, setRoi] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const imageCache = useRef<Map<number, HTMLImageElement>>(new Map());

  // 現在のフレームを描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frames[currentFrame]) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // キャッシュから画像を取得または作成
    let img = imageCache.current.get(currentFrame);
    
    if (!img) {
      img = new Image();
      img.src = frames[currentFrame];
      imageCache.current.set(currentFrame, img);
    }

    const drawImage = () => {
      if (!canvas || !ctx || !img) return;
      
      // キャンバスをクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 画像のサイズに合わせてキャンバスをリサイズ
      if (img.complete && img.naturalWidth > 0) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        
        // スタートライン
        if (currentFrame === startFrame) {
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(canvas.width * 0.3, 0);
          ctx.lineTo(canvas.width * 0.3, canvas.height);
          ctx.stroke();
        }
        
        // フィニッシュライン
        if (currentFrame === finishFrame) {
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(canvas.width * 0.7, 0);
          ctx.lineTo(canvas.width * 0.7, canvas.height);
          ctx.stroke();
        }
        
        // ROI表示
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
      }
    };

    if (img.complete) {
      drawImage();
    } else {
      img.onload = drawImage;
    }
  }, [currentFrame, frames, startFrame, finishFrame, roi]);

  // マウスイベントハンドラ
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelectingRoi || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setRoiStart({x, y});
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelectingRoi || !roiStart || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setRoi({
      x: Math.min(roiStart.x, x),
      y: Math.min(roiStart.y, y),
      width: Math.abs(x - roiStart.x),
      height: Math.abs(y - roiStart.y)
    });
  };

  const handleMouseUp = () => {
    if (!isSelectingRoi || !roi) return;
    
    setIsSelectingRoi(false);
    setRoiStart(null);
    
    // ROI選択を親に通知
    if (onSelectRoi && roi.width > 0.05 && roi.height > 0.05) {
      onSelectRoi(currentFrame, roi);
    }
  };

  // スライダー変更ハンドラ（軽量版）
  const handleSliderChange = (value: number, type: 'start' | 'finish' | 'mid' | 'nav') => {
    setCurrentFrame(value);
    
    switch(type) {
      case 'start':
        onChangeStartFrame(value);
        break;
      case 'finish':
        onChangeFinishFrame(value);
        break;
      case 'mid':
        if (onChangeMidFrame) onChangeMidFrame(value);
        break;
    }
  };

  const hasPose = existingPoseData?.has(currentFrame) || false;

  return (
    <div className="step5-simple">
      <div className="step5-header">
        <h2>📏 区間設定</h2>
        <p>スライダーで開始・終了・中間点を設定してください</p>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="main-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isSelectingRoi ? 'crosshair' : 'default' }}
        />
      </div>

      <div className="controls">
        <div className="frame-info">
          <span>フレーム: {currentFrame} / {frames.length - 1}</span>
          <span>時間: {(currentFrame / fps).toFixed(2)}秒</span>
          {hasPose ? (
            <span className="pose-ok">✅ 姿勢検出済み</span>
          ) : (
            <span className="pose-none">❌ 姿勢未検出</span>
          )}
        </div>

        {!hasPose && (
          <div className="roi-controls">
            <button
              className="btn-roi"
              onClick={() => {
                setIsSelectingRoi(true);
                setRoi(null);
              }}
            >
              🎯 手動で人物範囲を指定
            </button>
            {isSelectingRoi && (
              <span className="roi-hint">画面上でドラッグして人物を囲んでください</span>
            )}
          </div>
        )}

        <div className="sliders">
          <div className="slider-row">
            <label>開始点</label>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={startFrame}
              onChange={(e) => handleSliderChange(Number(e.target.value), 'start')}
            />
            <span>{startFrame}</span>
          </div>

          <div className="slider-row">
            <label>終了点</label>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={finishFrame}
              onChange={(e) => handleSliderChange(Number(e.target.value), 'finish')}
            />
            <span>{finishFrame}</span>
          </div>

          {onChangeMidFrame && (
            <div className="slider-row">
              <label>中間点</label>
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={midFrame || Math.floor((startFrame + finishFrame) / 2)}
                onChange={(e) => handleSliderChange(Number(e.target.value), 'mid')}
              />
              <span>{midFrame || Math.floor((startFrame + finishFrame) / 2)}</span>
            </div>
          )}

          <div className="slider-row nav">
            <label>フレーム移動</label>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={currentFrame}
              onChange={(e) => handleSliderChange(Number(e.target.value), 'nav')}
            />
            <button onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}>◀</button>
            <button onClick={() => setCurrentFrame(Math.min(frames.length - 1, currentFrame + 1))}>▶</button>
          </div>
        </div>
      </div>
    </div>
  );
};