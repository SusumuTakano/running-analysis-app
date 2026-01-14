/**
 * Multi-Camera Analysis Type Definitions
 * Clean, strongly-typed interfaces for multi-camera analysis
 */

export interface FramePoseData {
  landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>;
  worldLandmarks?: Array<{ x: number; y: number; z: number; visibility?: number }>;
}

export interface CalibrationData {
  H_img_to_world: number[][];  // 3x3 Homography matrix
  coneClicks: {
    x0_near: [number, number];
    x0_far: [number, number];
    x1_near: [number, number];
    x1_far: [number, number];
  };
  videoWidth: number;
  videoHeight: number;
  quality: number;  // 0-1, calibration quality score
}

/**
 * Raw data from a single segment (before analysis)
 */
export interface SegmentRawData {
  id: string;
  segmentIndex: number;
  videoFile: File;
  videoObjectURL: string;
  
  // Distance bounds
  startDistanceM: number;
  endDistanceM: number;
  
  // Frame data
  fps: number;
  totalFrames: number;
  frames: ImageData[];
  
  // Pose estimation results
  poseResults: (FramePoseData | null)[];
  
  // User-marked frames
  contactFrames: number[];      // Manual ground contact marks
  toeOffFrames: number[];       // Manual toe-off marks (optional)
  
  // Calibration
  calibration: CalibrationData | null;
}

/**
 * Single step data with global coordinates
 */
export interface StepData {
  // Identification
  stepId: string;
  segmentId: string;
  localStepIndex: number;       // Index within segment (0, 1, 2, ...)
  globalStepIndex?: number;     // Index in merged result (assigned later)
  
  // Frame timing
  contactFrame: number;
  toeOffFrame: number;
  
  // Global distance (Homography-corrected)
  distanceAtContactM: number;   // Global distance (0-15m)
  
  // Step metrics
  strideM: number | null;       // Distance to next contact
  contactTimeS: number;
  flightTimeS: number;
  
  // Kinematics
  speedMps: number | null;
  cadence: number | null;
  
  // Quality flags
  isInterpolated: boolean;      // Was this step interpolated?
  quality: 'good' | 'warning' | 'error';
  
  // Raw foot position (for debugging)
  footPixelX: number;
  footPixelY: number;
}

/**
 * Analysis result for a single segment
 */
export interface SegmentAnalysisResult {
  segmentId: string;
  segmentIndex: number;
  
  // Steps detected in this segment
  steps: StepData[];
  
  // Summary statistics
  summary: {
    totalSteps: number;
    avgStrideM: number;
    avgSpeedMps: number;
    avgContactTimeS: number;
    avgFlightTimeS: number;
  };
  
  // Metadata
  metadata: {
    fps: number;
    totalFrames: number;
    successfulPoseFrames: number;
    calibrationQuality: number;
  };
  
  // Validation
  validation: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };
}

/**
 * Boundary step information (for merging)
 */
export interface BoundaryStepGroup {
  boundaryPositionM: number;    // Expected boundary (5m, 10m, etc.)
  steps: StepData[];            // Steps near this boundary
  selectedStep: StepData | null; // The step chosen to represent this boundary
  duplicates: StepData[];       // Steps marked as duplicates
}

/**
 * Final merged analysis result
 */
export interface MergedAnalysisResult {
  // All steps (deduplicated and interpolated)
  allSteps: StepData[];
  
  // Summary for the entire run
  summary: {
    totalDistanceM: number;
    totalSteps: number;
    realSteps: number;            // Non-interpolated steps
    interpolatedSteps: number;
    
    totalTimeS: number;
    avgSpeedMps: number;
    avgStrideM: number;
    avgCadence: number;
    
    medianStrideM: number;        // More robust than average
  };
  
  // Boundary analysis
  boundaries: BoundaryStepGroup[];
  
  // Warnings and errors
  warnings: Warning[];
  errors: Error[];
}

export interface Warning {
  type: 'gap' | 'stride_anomaly' | 'calibration' | 'duplicate';
  message: string;
  segmentId?: string;
  stepId?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Error {
  type: 'missing_data' | 'calibration_failure' | 'computation_error';
  message: string;
  segmentId?: string;
  details?: string;
}

/**
 * Multi-camera state (managed by React)
 */
export interface MultiCameraState {
  // Configuration
  runId: string;
  totalDistanceM: number;
  segmentLengthM: number;
  
  // Segments
  segments: SegmentRawData[];
  currentSegmentIndex: number;
  
  // Analysis results
  segmentResults: Map<string, SegmentAnalysisResult>;
  mergedResult: MergedAnalysisResult | null;
  
  // Status
  status: 'setup' | 'analyzing' | 'merging' | 'complete' | 'error';
  currentOperation: string;
}
