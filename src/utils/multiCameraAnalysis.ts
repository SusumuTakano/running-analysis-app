/**
 * Multi-Camera Analysis Utilities
 * Clean separation of per-segment analysis and cross-segment merging
 *
 * Updated:
 * - generateSegments supports laneWidth + capture margins (pre/post)
 * - add cone-based planar calibration: computeHomographyImgToWorld
 * - mergeSegments sorting is robust even if segmentIndex is missing
 * - overlap utilities no longer hard-code 10m
 */

import {
  Run,
  RunSegment,
  Step,
  SegmentAnalysisResult,
  RunAnalysisResult,
  ImgPoint,
  Homography3x3,
} from '../types/multiCameraTypes';

/**
 * Analyze a single segment using existing single-camera logic
 * This wraps the existing analysis pipeline
 */
export async function analyzeSegment(
  videoFile: File,
  segment: RunSegment,
  existingAnalysisLogic: (file: File) => Promise<any>
): Promise<SegmentAnalysisResult> {
  const label = typeof segment.segmentIndex === 'number'
    ? `#${segment.segmentIndex}`
    : `${segment.startDistanceM}-${segment.endDistanceM}m`;

  console.log(`🎥 Analyzing segment ${label} (${segment.startDistanceM}-${segment.endDistanceM}m)`);

  try {
    // Call existing single-camera analysis
    const rawResults = await existingAnalysisLogic(videoFile);

    // Convert raw results to our Step format
    const steps: Step[] =
      rawResults.stepMetrics?.map((metric: any, index: number) => ({
        id: `${segment.id}_step_${index}`,
        runSegmentId: segment.id,
        localStepIndex: index,
        contactFrame: metric.contactFrame || 0,
        toeOffFrame: metric.toeOffFrame || 0,
        contactTimeSec: metric.contactTime || 0,
        flightTimeSec: metric.flightTime || 0,
        stepLengthM: metric.stride || 0,
        distanceFromSegmentStartM:
          metric.distanceFromStart ?? index * (metric.stride || 0),
        speedMps: metric.speedMps,
        cadence: metric.cadence,
        hipAngle: metric.hipAngle,
        kneeAngle: metric.kneeAngle,
        ankleAngle: metric.ankleAngle,
      })) || [];

    // Calculate summary statistics
    const summary = {
      totalSteps: steps.length,
      avgContactTime:
        (steps.reduce((sum, s) => sum + s.contactTimeSec, 0) / steps.length) || 0,
      avgFlightTime:
        (steps.reduce((sum, s) => sum + s.flightTimeSec, 0) / steps.length) || 0,
      avgStepLength:
        (steps.reduce((sum, s) => sum + s.stepLengthM, 0) / steps.length) || 0,
      avgSpeed:
        (steps.reduce((sum, s) => sum + (s.speedMps || 0), 0) / steps.length) || 0,
      avgCadence:
        (steps.reduce((sum, s) => sum + (s.cadence || 0), 0) / steps.length) || 0,
    };

    return {
      segmentId: segment.id,
      steps,
      summary,
      metadata: {
        fps: segment.fps,
        totalFrames: rawResults.totalFrames || 0,
        successfulPoseFrames: rawResults.successfulPoseFrames || 0,
        poseSuccessRate: rawResults.poseSuccessRate || 0,
      },
    };
  } catch (error) {
    console.error(`Error analyzing segment ${label}:`, error);
    throw error;
  }
}

/**
 * Merge multiple segment results into a single continuous run
 * Assigns global step indices and calculates cumulative distances
 */
export function mergeSegments(
  run: Run,
  segments: RunSegment[],
  segmentResults: SegmentAnalysisResult[]
): RunAnalysisResult {
  console.log(`📊 Merging ${segments.length} segments into continuous run`);

  // Robust sorting: prefer segmentIndex, else startDistanceM
  const sortedSegments = [...segments].sort((a, b) => {
    const ai = typeof a.segmentIndex === 'number' ? a.segmentIndex : null;
    const bi = typeof b.segmentIndex === 'number' ? b.segmentIndex : null;
    if (ai !== null && bi !== null) return ai - bi;
    if (ai !== null && bi === null) return -1;
    if (ai === null && bi !== null) return 1;
    return a.startDistanceM - b.startDistanceM;
  });

  const sortedResults: SegmentAnalysisResult[] = sortedSegments
    .map((seg) => segmentResults.find((r) => r.segmentId === seg.id))
    .filter((r): r is SegmentAnalysisResult => !!r);

  // Merge all steps with global indexing
  let globalStepCounter = 0;
  const allSteps: Step[] = [];

  sortedResults.forEach((result, segIdx) => {
    const segment = sortedSegments[segIdx];

    result.steps.forEach((step) => {
      allSteps.push({
        ...step,
        globalStepIndex: globalStepCounter++,
        distanceFromRunStartM: segment.startDistanceM + step.distanceFromSegmentStartM,
      });
    });
  });

  const totalSteps = allSteps.length || 1;
  const totalContactTime = allSteps.reduce((sum, s) => sum + s.contactTimeSec, 0);
  const totalFlightTime = allSteps.reduce((sum, s) => sum + s.flightTimeSec, 0);
  const totalTime = totalContactTime + totalFlightTime;

  const summary = {
    totalDistance: run.totalDistanceM,
    totalSteps: allSteps.length,
    totalTime: totalTime,
    avgSpeed: totalTime > 0 ? run.totalDistanceM / totalTime : 0,
    maxSpeed: allSteps.length > 0 ? Math.max(...allSteps.map((s) => s.speedMps || 0)) : 0,
    avgContactTime: totalContactTime / totalSteps,
    avgFlightTime: totalFlightTime / totalSteps,
    avgStepLength: allSteps.reduce((sum, s) => sum + s.stepLengthM, 0) / totalSteps,
    avgCadence: totalTime > 0 ? (allSteps.length / (totalTime / 60)) : 0, // steps per minute
  };

  const distanceBasedMetrics = {
    distance: allSteps.map((s) => s.distanceFromRunStartM || 0),
    speed: allSteps.map((s) => s.speedMps || 0),
    stepLength: allSteps.map((s) => s.stepLengthM),
    contactTime: allSteps.map((s) => s.contactTimeSec),
    flightTime: allSteps.map((s) => s.flightTimeSec),
  };

  return {
    run,
    segments: sortedSegments,
    allSteps,
    summary,
    distanceBasedMetrics,
  };
}

/**
 * Generate segment configuration based on total distance and segment length
 * Extended: supports laneWidth + capture margins (pre/post)
 */
export function generateSegments(
  runId: string,
  totalDistanceM: number,
  segmentLengthM: number,
  opts: {
    fps?: number;
    laneWidthM?: number;
    preMarginM?: number;
    postMarginM?: number;
  } = {}
): RunSegment[] {
  const fps = opts.fps ?? 60;
  const laneWidthM = opts.laneWidthM;
  const pre = opts.preMarginM ?? 0;
  const post = opts.postMarginM ?? 0;

  const numSegments = Math.ceil(totalDistanceM / segmentLengthM);
  const segments: RunSegment[] = [];

  for (let i = 0; i < numSegments; i++) {
    const start = i * segmentLengthM;
    const end = Math.min((i + 1) * segmentLengthM, totalDistanceM);

    segments.push({
      id: `${runId}_segment_${i}`,
      runId,
      segmentIndex: i,
      startDistanceM: start,
      endDistanceM: end,
      captureStartDistanceM: start - pre,
      captureEndDistanceM: end + post,
      laneWidthM,
      fps,
      status: 'pending',
    });
  }

  return segments;
}

/**
 * Validate that all segments have been uploaded
 */
export function validateSegmentUploads(
  segments: RunSegment[]
): { isValid: boolean; missingSegments: number[] } {
  const sorted = [...segments].sort((a, b) => (a.startDistanceM - b.startDistanceM));

  const missingSegments = sorted
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => !s.videoFile && !s.videoFilePath)
    .map(({ s, idx }) => (typeof s.segmentIndex === 'number' ? s.segmentIndex : idx));

  return {
    isValid: missingSegments.length === 0,
    missingSegments,
  };
}

/**
 * Calculate overlap between adjacent segments (for sync/link features)
 * Improved: no hard-coded 10m; optionally pass segmentLengthM.
 */
export function findOverlapFrames(
  segment1Result: SegmentAnalysisResult,
  segment2Result: SegmentAnalysisResult,
  overlapDistanceM: number = 2,
  segmentLengthM: number = 10
): { segment1Steps: Step[]; segment2Steps: Step[] } {
  const seg1Threshold = Math.max(0, segmentLengthM - overlapDistanceM);

  const segment1Overlap = segment1Result.steps.filter(
    (s) => s.distanceFromSegmentStartM >= seg1Threshold
  );

  const segment2Overlap = segment2Result.steps.filter(
    (s) => s.distanceFromSegmentStartM <= overlapDistanceM
  );

  return {
    segment1Steps: segment1Overlap,
    segment2Steps: segment2Overlap,
  };
}

/**
 * Compute homography H that maps image(px) -> world(m) using 4 point correspondences.
 * We solve an 8x8 linear system with h33 fixed to 1.
 */
export function computeHomographyImgToWorld(
  imgPoints: {
    x0_near: ImgPoint;
    x0_far: ImgPoint;
    x1_near: ImgPoint;
    x1_far: ImgPoint;
  },
  worldPoints: {
    x0_near: [number, number];
    x0_far: [number, number];
    x1_near: [number, number];
    x1_far: [number, number];
  }
): Homography3x3 {
  const pairs: Array<{ u: number; v: number; x: number; y: number }> = [
    { u: imgPoints.x0_near[0], v: imgPoints.x0_near[1], x: worldPoints.x0_near[0], y: worldPoints.x0_near[1] },
    { u: imgPoints.x0_far[0],  v: imgPoints.x0_far[1],  x: worldPoints.x0_far[0],  y: worldPoints.x0_far[1]  },
    { u: imgPoints.x1_near[0], v: imgPoints.x1_near[1], x: worldPoints.x1_near[0], y: worldPoints.x1_near[1] },
    { u: imgPoints.x1_far[0],  v: imgPoints.x1_far[1],  x: worldPoints.x1_far[0],  y: worldPoints.x1_far[1]  },
  ];

  // Build A (8x8) and b (8)
  const A: number[][] = [];
  const b: number[] = [];

  // unknown vector h = [h11,h12,h13,h21,h22,h23,h31,h32], with h33 = 1
  for (const p of pairs) {
    const { u, v, x, y } = p;

    A.push([u, v, 1, 0, 0, 0, -x * u, -x * v]);
    b.push(x);

    A.push([0, 0, 0, u, v, 1, -y * u, -y * v]);
    b.push(y);
  }

  const h = solveLinearSystem(A, b); // length 8

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ];
}

/**
 * Apply homography H (image->world) to a pixel point (u,v).
 */
export function applyHomography(H: Homography3x3, u: number, v: number): [number, number] {
  const x = H[0][0] * u + H[0][1] * v + H[0][2];
  const y = H[1][0] * u + H[1][1] * v + H[1][2];
  const w = H[2][0] * u + H[2][1] * v + H[2][2];
  if (Math.abs(w) < 1e-12) return [NaN, NaN];
  return [x / w, y / w];
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length; // expected 8
  const M = A.map((row, i) => [...row, b[i]]); // augmented

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
    }
    if (Math.abs(M[pivotRow][col]) < 1e-12) {
      throw new Error('Homography solve failed: singular matrix (check cone clicks).');
    }

    // Swap
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    // Normalize pivot row
    const pivot = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pivot;

    // Eliminate other rows
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  // Extract solution
  return M.map((row) => row[n]);
}
