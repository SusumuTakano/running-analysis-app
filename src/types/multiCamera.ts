// マルチカメラ解析用の型定義

export interface Run {
  id: string;
  label: string;          // 例: "100m テスト 2025-12-05 #1"
  totalDistanceM: number; // 例: 100
  segmentLengthM: number; // 例: 10 （今は固定で良い）
  createdAt: Date;
  athleteId?: string;     // オプション：アスリートIDとの紐付け
  status: 'setup' | 'recording' | 'analyzing' | 'completed';
}

export interface RunSegment {
  id: string;
  runId: string;
  segmentIndex: number;   // 0,1,2,...9
  startDistanceM: number; // 0,10,20,...
  endDistanceM: number;   // 10,20,30,...
  sessionId?: string;     // 既存の running_analysis_sessions.id に紐付ける
  videoUrl?: string;      // 動画ファイルのURL
  status: 'pending' | 'uploaded' | 'calibrating' | 'analyzing' | 'completed' | 'error';
  calibrationData?: any;  // キャリブレーションデータ
}

export interface CombinedStepData {
  globalDistanceM: number;  // 0-100mの通算距離
  segmentIndex: number;     // どのセグメントか
  localDistanceM: number;   // セグメント内での距離
  strideLength: number;
  contactTime: number;
  flightTime: number;
  jointAngles?: {
    hip: number;
    knee: number;
    ankle: number;
  };
  timestamp: number;
}

export interface MultiCameraConfig {
  mode: 'single' | 'multi';
  totalDistanceOptions: number[]; // [20, 30, 40, 60, 80, 100]
  defaultSegmentLength: number;  // 10
}