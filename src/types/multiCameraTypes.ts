/**
 * Multi-Camera Sprint Analysis Types
 * Clean separation of concerns + marker-based (cone) calibration support
 *
 * ✅ Backward compatible with your current code:
 * - Existing Run / RunSegment / Step / Result types remain
 * - Adds optional fields for cone-based calibration + capture margins
 */

//
// Common aliases
//
export type RunStatus = 'setup' | 'processing' | 'completed' | 'error';
export type SegmentStatus = 'pending' | 'uploading' | 'analyzing' | 'completed' | 'error';

// Image point in pixels (u, v)
export type ImgPoint = [number, number];

// Homography matrix (3x3)
export type Homography3x3 = number[][];

//
// Main run entity for the entire sprint (e.g., 100m)
//
export interface Run {
  id: string;
  athleteId?: string;
  athleteName?: string;
  totalDistanceM: number;
  date: Date;
  status: RunStatus;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

//
// Cone-based (near/far) planar calibration per segment
// near = camera-side lane line (y=0), far = opposite side (y=laneWidthM)
// world coordinates: (x[m], y[m])
//
export interface SegmentCalibration {
  laneWidthM: number; // e.g., 1.22
  x0_m: number;       // segment start marker distance (e.g., 5)
  x1_m: number;       // segment end marker distance (e.g., 10)

  // Pixel clicks (center of cones) on the same frame
  imgPoints: {
    x0_near: ImgPoint;
    x0_far: ImgPoint;
    x1_near: ImgPoint;
    x1_far: ImgPoint;
  };

  // Optional: computed homography mapping image(px) -> world(m)
  // If you compute it later in analysis step, it can be omitted here.
  H_img_to_world?: Homography3x3;
}

//
// Optional time alignment parameters (no timecode required)
// t_global = a * t_local + b
// You can fill this later during stitching using overlap range.
//
export interface TimeAlignment {
  a: number; // scale (≈1.0)
  b: number; // offset (sec)
  method: 'overlap' | 'manual';
  overlapRangeM?: { start: number; end: number };
}

//
// Individual camera segment (e.g., 0-5m, 5-10m)
//
export interface RunSegment {
  id: string;
  runId: string;

  // Camera order (kept for compatibility; optional to allow generation without it)
  segmentIndex?: number; // 0, 1, 2, ... (camera order)

  // Analysis segment boundaries (marker-to-marker)
  startDistanceM: number; // 0, 5, 10, ...
  endDistanceM: number;   // 5, 10, 15, ...

  fps: number;

  // Video reference
  videoFilePath?: string;
  videoFile?: File;

  status: SegmentStatus;
  errorMessage?: string;

  // --- Added for your "cone linking" workflow (all optional for compatibility) ---

  // Recommended capture range including margins (e.g., -1〜6m for 0〜5m segment)
  captureStartDistanceM?: number; // startDistanceM - preMarginM
  captureEndDistanceM?: number;   // endDistanceM + postMarginM

  // Lane width for this segment (if not provided, use config laneWidthM)
  laneWidthM?: number; // default 1.22

  // Cone calibration (near/far at x0/x1)
  calibration?: SegmentCalibration;

  // Optional time alignment params estimated from overlap range
  timeAlignment?: TimeAlignment;
}

//
// Individual step metrics (belongs to a segment)
//
export interface Step {
  id: string;
  runSegmentId: string;
  localStepIndex: number;  // Step number within this segment (0, 1, 2, ...)
  globalStepIndex?: number; // Step number across entire run (will be set during merge)

  // Frame data
  contactFrame: number;
  toeOffFrame: number;

  // Time metrics
  contactTimeSec: number;
  flightTimeSec: number;

  // Distance metrics
  stepLengthM: number;
  distanceFromSegmentStartM: number;  // Distance from segment start
  distanceFromRunStartM?: number;     // Distance from 0m (will be set during merge)

  // Derived metrics
  speedMps?: number;
  cadence?: number;

  // Angle data (optional, for detailed analysis)
  hipAngle?: number;
  kneeAngle?: number;
  ankleAngle?: number;
}

//
// Analysis result for a segment
//
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

//
// Final merged run analysis
//
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
  // H-FVP (Horizontal Force-Velocity Profile) - optional
  hfvp?: {
    F0: number;           // Maximum horizontal force (N)
    V0: number;           // Maximum velocity (m/s)
    Pmax: number;         // Maximum power (W)
    RFmax: number;        // Maximum ratio of force (%)
    DRF: number;          // Decrease in ratio of force (%/m/s)
    rSquared: number;     // Regression quality
    dataPoints: {
      velocity: number;
      force: number;
      power: number;
      forceRatio: number;
      distance: number;
    }[];
    summary: {
      avgForce: number;
      avgPower: number;
      peakVelocity: number;
      acceleration: number;
    };
  };
}

//
// UI State Management
//
export interface MultiCameraAnalysisState {
  currentRun: Run | null;
  segments: RunSegment[];
  segmentResults: Map<string, SegmentAnalysisResult>;
  mergedResult: RunAnalysisResult | null;
  currentProcessingSegmentIndex: number;
  isProcessing: boolean;
  error: string | null;
}

//
// Configuration for multi-camera setup
//
export interface MultiCameraConfig {
  segmentLengthM: number; // 5m or 10m
  totalDistanceM: number; // 15m, 30m, 60m, 100m, etc.
  fps: number;            // 60, 120, 240

  // Existing option
  overlapM?: number;      // Optional overlap between segments (e.g., 2m)

  // --- Added options (optional for compatibility) ---
  laneWidthM?: number;    // default 1.22
  preMarginM?: number;    // e.g., 1 (captureStart = x0 - 1)
  postMarginM?: number;   // e.g., 1 (captureEnd = x1 + 1)
}
