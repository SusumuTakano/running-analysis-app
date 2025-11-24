/**
 * 手動フェーズマーキング管理
 */

import { 
  ManualPhaseMarking, 
  VideoMetadata, 
  ValidationResult,
  SupportSide 
} from '../types/manual-analysis';

/**
 * マーキングを作成し、3フェーズのフレームを自動計算
 */
export function createMarking(
  contact_frame: number,
  toe_off_frame: number,
  support_side: SupportSide,
  notes: string = ''
): ManualPhaseMarking {
  const marking_id = `marking_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const created_at = new Date().toISOString();
  
  // 3フェーズのフレームを計算
  const phase_frames = calculatePhaseFrames(contact_frame, toe_off_frame);
  
  return {
    marking_id,
    contact_frame,
    toe_off_frame,
    support_side,
    early_contact_frame: phase_frames.early_contact,
    mid_stance_frame: phase_frames.mid_stance,
    pre_toe_off_frame: phase_frames.pre_toe_off,
    created_at,
    notes
  };
}

/**
 * 接地と離地から3フェーズのフレームを計算
 * 
 * 接地前半: 接地直後（接地フレーム + 15%）
 * 接地中判: 接地と離地の中間（50%）
 * 離地直前: 離地直前（離地フレーム - 15%）
 */
export function calculatePhaseFrames(
  contact_frame: number,
  toe_off_frame: number
): { early_contact: number; mid_stance: number; pre_toe_off: number } {
  const stance_duration = toe_off_frame - contact_frame;
  
  // 等間隔分割
  const early_contact = Math.round(contact_frame + stance_duration * 0.15);
  const mid_stance = Math.round(contact_frame + stance_duration * 0.5);
  const pre_toe_off = Math.round(toe_off_frame - stance_duration * 0.15);
  
  // フレーム番号の妥当性チェック
  return {
    early_contact: Math.max(contact_frame, early_contact),
    mid_stance,
    pre_toe_off: Math.min(toe_off_frame, pre_toe_off)
  };
}

/**
 * マーキングのバリデーション
 */
export function validateMarking(
  marking: Partial<ManualPhaseMarking>,
  video_metadata?: VideoMetadata
): ValidationResult {
  if (!marking.contact_frame || !marking.toe_off_frame || !marking.support_side) {
    return {
      is_valid: false,
      message: '接地フレーム、離地フレーム、支持脚の全てを指定してください'
    };
  }
  
  if (marking.contact_frame >= marking.toe_off_frame) {
    return {
      is_valid: false,
      message: '接地フレームは離地フレームより前である必要があります'
    };
  }
  
  if (marking.contact_frame < 0 || marking.toe_off_frame < 0) {
    return {
      is_valid: false,
      message: 'フレーム番号は0以上である必要があります'
    };
  }
  
  if (!['left', 'right'].includes(marking.support_side)) {
    return {
      is_valid: false,
      message: "支持脚は'left'または'right'である必要があります"
    };
  }
  
  // 動画の範囲チェック
  if (video_metadata && marking.toe_off_frame >= video_metadata.total_frames) {
    return {
      is_valid: false,
      message: `離地フレームが動画の範囲を超えています（最大: ${video_metadata.total_frames - 1}）`
    };
  }
  
  return {
    is_valid: true,
    message: 'OK'
  };
}

/**
 * 2つのマーキングが重複しているかチェック
 */
export function isOverlapping(
  marking1: ManualPhaseMarking,
  marking2: ManualPhaseMarking
): boolean {
  return !(
    marking1.toe_off_frame < marking2.contact_frame ||
    marking2.toe_off_frame < marking1.contact_frame
  );
}

/**
 * マーキングデータをJSON形式でエクスポート
 */
export function exportMarkings(
  markings: ManualPhaseMarking[],
  video_metadata: VideoMetadata
): string {
  const data = {
    video_metadata: {
      file_name: video_metadata.file_name,
      total_frames: video_metadata.total_frames,
      fps: video_metadata.fps,
      duration_seconds: video_metadata.duration_seconds,
      width: video_metadata.width,
      height: video_metadata.height
    },
    markings: markings.map(m => ({
      marking_id: m.marking_id,
      contact_frame: m.contact_frame,
      toe_off_frame: m.toe_off_frame,
      support_side: m.support_side,
      early_contact_frame: m.early_contact_frame,
      mid_stance_frame: m.mid_stance_frame,
      pre_toe_off_frame: m.pre_toe_off_frame,
      notes: m.notes,
      created_at: m.created_at
    })),
    exported_at: new Date().toISOString()
  };
  
  return JSON.stringify(data, null, 2);
}

/**
 * JSON形式からマーキングデータをインポート
 */
export function importMarkings(json_string: string): {
  markings: ManualPhaseMarking[];
  video_metadata: VideoMetadata;
} {
  const data = JSON.parse(json_string);
  
  return {
    markings: data.markings.map((m: any) => ({
      marking_id: m.marking_id,
      contact_frame: m.contact_frame,
      toe_off_frame: m.toe_off_frame,
      support_side: m.support_side,
      early_contact_frame: m.early_contact_frame,
      mid_stance_frame: m.mid_stance_frame,
      pre_toe_off_frame: m.pre_toe_off_frame,
      notes: m.notes || '',
      created_at: m.created_at
    })),
    video_metadata: {
      file_path: '',
      file_name: data.video_metadata.file_name,
      total_frames: data.video_metadata.total_frames,
      fps: data.video_metadata.fps,
      duration_seconds: data.video_metadata.duration_seconds,
      width: data.video_metadata.width,
      height: data.video_metadata.height
    }
  };
}

/**
 * フレーム番号を時間（秒）に変換
 */
export function frameToTime(frame_number: number, fps: number): number {
  return frame_number / fps;
}

/**
 * 時間（秒）をフレーム番号に変換
 */
export function timeToFrame(time_seconds: number, fps: number): number {
  return Math.round(time_seconds * fps);
}
