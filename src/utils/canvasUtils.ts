/**
 * Canvas座標系のユーティリティ関数
 * ChatGPT推奨: 全ての座標を統一されたCanvas座標で管理
 */

export type CanvasRoi = {
  x: number;      // Canvas座標（px）
  y: number;      // Canvas座標（px）
  width: number;  // 幅（px）
  height: number; // 高さ（px）
};

/**
 * マウス/タッチイベントからCanvas座標を取得
 */
export function getCanvasCoordinates(
  event: React.MouseEvent | React.TouchEvent,
  canvas: HTMLCanvasElement
): { x: number; y: number } | null {
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  
  // マウスイベントかタッチイベントかを判定
  let clientX: number;
  let clientY: number;
  
  if ('touches' in event) {
    if (event.touches.length === 0) return null;
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  // CSS上の座標をCanvas内部座標に変換
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  return { x, y };
}

/**
 * 動画フレームとオーバーレイを描画
 */
export function drawFrameWithOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement | ImageData | null,
  overlays?: {
    roi?: CanvasRoi | null;
    startLine?: number | null;  // X座標
    endLine?: number | null;    // X座標
    midLine?: number | null;     // X座標
    skeleton?: any | null;       // 姿勢推定結果
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // キャンバスをクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景（動画フレーム）を描画
  if (video) {
    if (video instanceof HTMLVideoElement) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else if (video instanceof ImageData) {
      ctx.putImageData(video, 0, 0);
    }
  }

  if (!overlays) return;

  // スタート線を描画
  if (overlays.startLine !== null && overlays.startLine !== undefined) {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(overlays.startLine, 0);
    ctx.lineTo(overlays.startLine, canvas.height);
    ctx.stroke();
    
    // ラベル
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('START', overlays.startLine + 5, 30);
  }

  // 終了線を描画
  if (overlays.endLine !== null && overlays.endLine !== undefined) {
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(overlays.endLine, 0);
    ctx.lineTo(overlays.endLine, canvas.height);
    ctx.stroke();
    
    // ラベル
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('FINISH', overlays.endLine + 5, 30);
  }

  // 中間線を描画
  if (overlays.midLine !== null && overlays.midLine !== undefined) {
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(overlays.midLine, 0);
    ctx.lineTo(overlays.midLine, canvas.height);
    ctx.stroke();
    
    // ラベル
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('MID', overlays.midLine + 5, 60);
  }

  // ROI（人物選択領域）を描画
  if (overlays.roi) {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      overlays.roi.x,
      overlays.roi.y,
      overlays.roi.width,
      overlays.roi.height
    );
    
    // 半透明の背景
    ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
    ctx.fillRect(
      overlays.roi.x,
      overlays.roi.y,
      overlays.roi.width,
      overlays.roi.height
    );
  }

  // スケルトンを描画（実装済みの場合）
  if (overlays.skeleton) {
    // 既存のスケルトン描画ロジックを呼び出す
    drawSkeleton(ctx, overlays.skeleton);
  }
}

/**
 * スケルトン描画（既存ロジックの移植）
 */
function drawSkeleton(ctx: CanvasRenderingContext2D, skeleton: any) {
  // TODO: 既存のスケルトン描画ロジックを移植
}

/**
 * Canvas座標のROIを正規化座標（0-1）に変換
 */
export function normalizeRoi(roi: CanvasRoi, canvas: HTMLCanvasElement): CanvasRoi {
  return {
    x: roi.x / canvas.width,
    y: roi.y / canvas.height,
    width: roi.width / canvas.width,
    height: roi.height / canvas.height,
  };
}

/**
 * 正規化座標（0-1）をCanvas座標に変換
 */
export function denormalizeRoi(normalizedRoi: CanvasRoi, canvas: HTMLCanvasElement): CanvasRoi {
  return {
    x: normalizedRoi.x * canvas.width,
    y: normalizedRoi.y * canvas.height,
    width: normalizedRoi.width * canvas.width,
    height: normalizedRoi.height * canvas.height,
  };
}

/**
 * ROIを使った姿勢推定用のフレーム切り出し
 */
export function extractRoiForPoseEstimation(
  sourceCanvas: HTMLCanvasElement,
  roi: CanvasRoi | null,
  targetWidth: number = 640,
  targetHeight: number = 360
): HTMLCanvasElement {
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = targetWidth;
  tmpCanvas.height = targetHeight;
  
  const ctx = tmpCanvas.getContext('2d');
  if (!ctx) return tmpCanvas;

  let sx = 0, sy = 0, sw = sourceCanvas.width, sh = sourceCanvas.height;

  if (roi) {
    sx = roi.x;
    sy = roi.y;
    sw = roi.width;
    sh = roi.height;
  }

  // ROI部分を切り出してtargetサイズにリサイズ
  ctx.drawImage(
    sourceCanvas,
    sx, sy, sw, sh,  // source rectangle
    0, 0, targetWidth, targetHeight  // destination rectangle
  );

  return tmpCanvas;
}