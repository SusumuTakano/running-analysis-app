// 安全なMediaPipe初期化ユーティリティ

/**
 * MediaPipeが利用可能かチェック
 */
export function isMediaPipeAvailable(): boolean {
  try {
    const mp = (window as any).mp;
    return !!(mp && mp.tasks && mp.tasks.vision && mp.tasks.vision.Pose);
  } catch {
    return false;
  }
}

/**
 * MediaPipe Poseインスタンスを安全に作成
 */
export function createSafePose(config: any) {
  if (!isMediaPipeAvailable()) {
    throw new Error('MediaPipe Poseが利用できません');
  }
  
  const mp = (window as any).mp;
  return new mp.tasks.vision.Pose(config);
}

/**
 * 代替の姿勢推定（MediaPipeが利用できない場合）
 */
export function estimatePoseFallback(canvas: HTMLCanvasElement): any {
  // 簡単な中心位置ベースの推定
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  // 中心に仮のランドマークを返す
  const width = canvas.width;
  const height = canvas.height;
  
  return {
    landmarks: [[
      { x: 0.5, y: 0.5, z: 0, visibility: 0.8 },
      { x: 0.5, y: 0.4, z: 0, visibility: 0.8 },
      { x: 0.5, y: 0.3, z: 0, visibility: 0.8 }
    ]]
  };
}

/**
 * ファイルタイプを判定
 */
export function getFileType(file: File): 'video' | 'image' | 'unsupported' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return 'unsupported';
}

/**
 * ファイルサイズチェック
 */
export function validateFileSize(file: File, maxSizeMB: number = 50): boolean {
  const maxSize = maxSizeMB * 1024 * 1024;
  return file.size <= maxSize;
}