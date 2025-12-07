import React, { useRef, useState } from 'react';

export type Roi = {
  x: number;      // 左上のX (0-1の正規化座標)
  y: number;      // 左上のY (0-1の正規化座標)
  width: number;  // 幅 (0-1の正規化座標)
  height: number; // 高さ (0-1の正規化座標)
};

type ManualRoiSelectorProps = {
  enabled: boolean;
  onChangeRoi: (roi: Roi | null) => void;
  onCancel?: () => void;
};

const ManualRoiSelector: React.FC<ManualRoiSelectorProps> = ({
  enabled,
  onChangeRoi,
  onCancel,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<Roi | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enabled || !overlayRef.current) return;
    e.preventDefault();
    
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setDragStart({ x, y });
    setDragRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!enabled || !overlayRef.current || !dragStart) return;
    e.preventDefault();
    
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const x0 = Math.min(dragStart.x, x);
    const y0 = Math.min(dragStart.y, y);
    const x1 = Math.max(dragStart.x, x);
    const y1 = Math.max(dragStart.y, y);

    const roi: Roi = {
      x: Math.max(0, Math.min(1, x0)),
      y: Math.max(0, Math.min(1, y0)),
      width: Math.max(0, Math.min(1, x1 - x0)),
      height: Math.max(0, Math.min(1, y1 - y0)),
    };

    setDragRect(roi);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!enabled || !dragRect) return;
    e.preventDefault();
    
    setDragStart(null);
    
    // 最小サイズチェック（5%以上の大きさが必要）
    if (dragRect.width > 0.05 && dragRect.height > 0.05) {
      onChangeRoi(dragRect);
    } else {
      setDragRect(null);
      if (onCancel) onCancel();
    }
  };

  const handleMouseLeave = () => {
    if (dragStart && dragRect) {
      // マウスが領域外に出た場合も選択を確定
      handleMouseUp({} as React.MouseEvent);
    }
  };

  if (!enabled) return null;

  return (
    <>
      <div
        ref={overlayRef}
        className={`roi-overlay ${!enabled ? 'disabled' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {dragRect && dragRect.width > 0 && dragRect.height > 0 && (
          <div
            className="roi-rect"
            style={{
              left: `${dragRect.x * 100}%`,
              top: `${dragRect.y * 100}%`,
              width: `${dragRect.width * 100}%`,
              height: `${dragRect.height * 100}%`,
            }}
          />
        )}
      </div>
      
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
          setDragRect(null);
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

export default ManualRoiSelector;