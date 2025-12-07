/**
 * Multi-Camera Sprint Analysis Types
 * Based on ChatGPT's recommendation for clean separation of concerns
 */

// Main run entity for the entire sprint (e.g., 100m)
export interface Run {
  id: string;
  athleteId?: string;
  athleteName?: string;
  totalDistanceM: number;
  date: Date;
  status: 'setup' | 'processing' | 'completed' | 'error';
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// Individual camera segment (e.g., 0-10m, 10-20m)
export interface RunSegment {
  id: string;
  runId: string;
  segmentIndex: number; // 0, 1, 2, ... (camera order)
  startDistanceM: number; // 0, 10, 20, ...
  endDistanceM: number; // 10, 20, 30, ...
  fps: number;
  videoFilePath?: string;
  videoFile?: File;
  status: 'pending' | 'uploading' | 'analyzing' | 'completed' | 'error';
  errorMessage?: string;
}

// Individual step metrics (belongs to a segment)
export interface Step {
  id: string;
  runSegmentId: string;
  localStepIndex: number; // Step number within this segment (0, 1, 2, ...)
  globalStepIndex?: number; // Step number across entire run (will be set during merge)
  
  // Frame data
  contactFrame: number;
  toeOffFrame: number;
  
  // Time metrics
  contactTimeSec: number;
  flightTimeSec: number;
  
  // Distance metrics
  stepLengthM: number;
  distanceFromSegmentStartM: number; // Distance from segment start
  distanceFromRunStartM?: number; // Distance from 0m (will be set during merge)
  
  // Derived metrics
  speedMps?: number;
  cadence?: number;
  
  // Angle data (optional, for detailed analysis)
  hipAngle?: number;
  kneeAngle?: number;
  ankleAngle?: number;
}

// Analysis result for a segment
export interface SegmentAnalysisResult {
  segmentId: string;
  steps: Step[];
  summary: {
    totalSteps: number;
    avgContactTime: number;
    avgFlightTime: number;
    avgStepLength: number;
    avgSpeed: number;
    avgCadence: number;
  };
  metadata: {
    fps: number;
    totalFrames: number;
    successfulPoseFrames: number;
    poseSuccessRate: number;
  };
}

// Final merged run analysis
export interface RunAnalysisResult {
  run: Run;
  segments: RunSegment[];
  allSteps: Step[]; // All steps with globalStepIndex assigned
  summary: {
    totalDistance: number;
    totalSteps: number;
    totalTime: number;
    avgSpeed: number;
    maxSpeed: number;
    avgContactTime: number;
    avgFlightTime: number;
    avgStepLength: number;
    avgCadence: number;
  };
  // For visualization
  distanceBasedMetrics: {
    distance: number[];
    speed: number[];
    stepLength: number[];
    contactTime: number[];
    flightTime: number[];
  };
}

// UI State Management
export interface MultiCameraAnalysisState {
  currentRun: Run | null;
  segments: RunSegment[];
  segmentResults: Map<string, SegmentAnalysisResult>;
  mergedResult: RunAnalysisResult | null;
  currentProcessingSegmentIndex: number;
  isProcessing: boolean;
  error: string | null;
}

// Configuration for multi-camera setup
export interface MultiCameraConfig {
  segmentLengthM: number; // 5m or 10m
  totalDistanceM: number; // 20m, 30m, 60m, 100m, etc.
  fps: number; // 60, 120, 240
  overlapM?: number; // Optional overlap between segments (e.g., 2m)
}