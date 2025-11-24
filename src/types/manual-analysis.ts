/**
 * 手動フェーズマーキング用の型定義
 */

export type StancePhase = 'EARLY_CONTACT' | 'MID_STANCE' | 'PRE_TOE_OFF';

export type SupportSide = 'left' | 'right';

/**
 * 手動でマーキングしたフェーズ情報
 */
export interface ManualPhaseMarking {
  /** マーキングID */
  marking_id: string;
  /** 接地フレーム番号 */
  contact_frame: number;
  /** 離地フレーム番号 */
  toe_off_frame: number;
  /** 支持脚 */
  support_side: SupportSide;
  
  /** 自動計算されたフレーム番号 */
  early_contact_frame: number;  // 接地前半
  mid_stance_frame: number;      // 接地中判
  pre_toe_off_frame: number;     // 離地直前
  
  /** メタデータ */
  created_at: string;
  notes: string;
}

/**
 * 動画メタデータ
 */
export interface VideoMetadata {
  file_path: string;
  file_name: string;
  total_frames: number;
  fps: number;
  width: number;
  height: number;
  duration_seconds: number;
}

/**
 * マーキングバリデーション結果
 */
export interface ValidationResult {
  is_valid: boolean;
  message: string;
}

/**
 * 角度測定結果（簡略版）
 */
export interface AngleMeasurement {
  angle: number;
  phase: StancePhase;
  frame_number: number;
}

/**
 * 分析結果
 */
export interface AnalysisResult {
  marking_id: string;
  support_side: SupportSide;
  
  /** 各フェーズの角度 */
  support_thigh_angles: {
    early_contact: number;
    mid_stance: number;
    pre_toe_off: number;
  };
  
  swing_thigh_angles: {
    early_contact: number;
    mid_stance: number;
    pre_toe_off: number;
  };
  
  knee_flexion_angles: {
    early_contact: number;
    mid_stance: number;
    pre_toe_off: number;
  };
  
  elbow_angles: {
    early_contact: number;
    mid_stance: number;
    pre_toe_off: number;
  };
  
  /** フレーム情報 */
  frames: {
    contact: number;
    early_contact: number;
    mid_stance: number;
    pre_toe_off: number;
    toe_off: number;
  };
}

/**
 * 複数サイクルの分析サマリー
 */
export interface AnalysisSummary {
  total_cycles: number;
  average_angles: {
    [key: string]: number;
  };
  individual_results: AnalysisResult[];
}
