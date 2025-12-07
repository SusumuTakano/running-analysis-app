import React, { useRef, useState, useEffect } from 'react';
import { CanvasRoi, getCanvasCoordinates, drawFrameWithOverlay } from '../utils/canvasUtils';

type CanvasRoiSelectorProps = {
  canvas: HTMLCanvasElement | null;
  enabled: boolean;
  currentFrame: ImageData | null;
  onChangeRoi: (roi: CanvasRoi | null) => void;
  onCancel?: () => void;
  overlays?: {
    startLine?: number | null;
    endLine?: number | null;
    midLine?: number | null;
  };
};

/**
 * Canvas座標系で直接ROIを選択するコンポーネント
 * ChatGPT推奨: 座標系のズレを防ぐため、Canvas上で直接操作
 */
const CanvasRoiSelector: React.FC<CanvasRoiSelectorProps> = ({
  canvas,
  enabled,
  currentFrame,
  onChangeRoi,
  onCancel,
  overlays = {},
}) => {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRoi, setCurrentRoi] = useState<CanvasRoi | null>(null);

  // フレームとROIを描画
  useEffect(() => {
    if (!canvas || !enabled) return;

    const draw = () => {
      drawFrameWithOverlay(canvas, currentFrame, {
        roi: currentRoi,
        ...overlays,
      });
    };

    draw();
  }, [canvas, currentFrame, currentRoi, enabled, overlays]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || !canvas) return;
    e.preventDefault();

    const coords = getCanvasCoordinates(e as any, canvas);
    if (!coords) return;

    setDragStart(coords);
    setCurrentRoi({ x: coords.x, y: coords.y, width: 0, height: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || !canvas || !dragStart) return;
    e.preventDefault();

    const coords = getCanvasCoordinates(e as any, canvas);
    if (!coords) return;

    const x0 = Math.min(dragStart.x, coords.x);
    const y0 = Math.min(dragStart.y, coords.y);
    const x1 = Math.max(dragStart.x, coords.x);
    const y1 = Math.max(dragStart.y, coords.y);

    const roi: CanvasRoi = {
      x: Math.max(0, Math.min(canvas.width, x0)),
      y: Math.max(0, Math.min(canvas.height, y0)),
      width: Math.min(canvas.width - x0, x1 - x0),
      height: Math.min(canvas.height - y0, y1 - y0),
    };

    setCurrentRoi(roi);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || !canvas || !currentRoi) return;
    e.preventDefault();

    setDragStart(null);

    // 最小サイズチェック（画像の5%以上）
    const minSize = Math.min(canvas.width, canvas.height) * 0.05;
    if (currentRoi.width > minSize && currentRoi.height > minSize) {
      onChangeRoi(currentRoi);
    } else {
      setCurrentRoi(null);
      if (onCancel) onCancel();
    }
  };

  if (!enabled || !canvas) return null;

  return (
    <>
      {/* Canvas要素は親コンポーネントで管理、イベントハンドラのみ追加 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          cursor: 'crosshair',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      
      {/* 説明テキスト */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#00ff88',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        zIndex: 11,
        pointerEvents: 'none',
      }}>
        🎯 ドラッグして人物を囲んでください
      </div>
      
      {/* キャンセルボタン */}
      <button
        onClick={() => {
          setDragStart(null);
          setCurrentRoi(null);
          if (onCancel) onCancel();
        }}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#dc2626',
          color: 'white',
          padding: '10px 24px',
          borderRadius: '8px',
          fontSize: '1rem',
          fontWeight: 'bold',
          zIndex: 11,
          cursor: 'pointer',
          border: 'none',
        }}
      >
        キャンセル
      </button>
    </>
  );
};

export default CanvasRoiSelector;