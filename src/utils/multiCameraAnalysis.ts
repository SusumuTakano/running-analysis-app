/**
 * Multi-Camera Analysis Utilities
 * Clean separation of per-segment analysis and cross-segment merging
 */

import { 
  Run, 
  RunSegment, 
  Step, 
  SegmentAnalysisResult, 
  RunAnalysisResult 
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
  console.log(`🎥 Analyzing segment ${segment.segmentIndex} (${segment.startDistanceM}-${segment.endDistanceM}m)`);
  
  try {
    // Call existing single-camera analysis
    const rawResults = await existingAnalysisLogic(videoFile);
    
    // Convert raw results to our Step format
    const steps: Step[] = rawResults.stepMetrics?.map((metric: any, index: number) => ({
      id: `${segment.id}_step_${index}`,
      runSegmentId: segment.id,
      localStepIndex: index,
      contactFrame: metric.contactFrame || 0,
      toeOffFrame: metric.toeOffFrame || 0,
      contactTimeSec: metric.contactTime || 0,
      flightTimeSec: metric.flightTime || 0,
      stepLengthM: metric.stride || 0,
      distanceFromSegmentStartM: metric.distanceFromStart || (index * (metric.stride || 0)),
      speedMps: metric.speedMps,
      cadence: metric.cadence,
      hipAngle: metric.hipAngle,
      kneeAngle: metric.kneeAngle,
      ankleAngle: metric.ankleAngle,
    })) || [];
    
    // Calculate summary statistics
    const summary = {
      totalSteps: steps.length,
      avgContactTime: steps.reduce((sum, s) => sum + s.contactTimeSec, 0) / steps.length || 0,
      avgFlightTime: steps.reduce((sum, s) => sum + s.flightTimeSec, 0) / steps.length || 0,
      avgStepLength: steps.reduce((sum, s) => sum + s.stepLengthM, 0) / steps.length || 0,
      avgSpeed: steps.reduce((sum, s) => sum + (s.speedMps || 0), 0) / steps.length || 0,
      avgCadence: steps.reduce((sum, s) => sum + (s.cadence || 0), 0) / steps.length || 0,
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
      }
    };
  } catch (error) {
    console.error(`Error analyzing segment ${segment.segmentIndex}:`, error);
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
  
  // Sort segments by segmentIndex to ensure correct order
  const sortedSegments = [...segments].sort((a, b) => a.segmentIndex - b.segmentIndex);
  const sortedResults = sortedSegments.map(seg => 
    segmentResults.find(r => r.segmentId === seg.id)!
  ).filter(Boolean);
  
  // Merge all steps with global indexing
  let globalStepCounter = 0;
  const allSteps: Step[] = [];
  
  sortedResults.forEach((result, segIdx) => {
    const segment = sortedSegments[segIdx];
    
    result.steps.forEach(step => {
      allSteps.push({
        ...step,
        globalStepIndex: globalStepCounter++,
        distanceFromRunStartM: segment.startDistanceM + step.distanceFromSegmentStartM
      });
    });
  });
  
  // Calculate overall summary
  const totalSteps = allSteps.length;
  const totalContactTime = allSteps.reduce((sum, s) => sum + s.contactTimeSec, 0);
  const totalFlightTime = allSteps.reduce((sum, s) => sum + s.flightTimeSec, 0);
  const totalTime = totalContactTime + totalFlightTime;
  
  const summary = {
    totalDistance: run.totalDistanceM,
    totalSteps,
    totalTime,
    avgSpeed: run.totalDistanceM / totalTime,
    maxSpeed: Math.max(...allSteps.map(s => s.speedMps || 0)),
    avgContactTime: totalContactTime / totalSteps,
    avgFlightTime: totalFlightTime / totalSteps,
    avgStepLength: allSteps.reduce((sum, s) => sum + s.stepLengthM, 0) / totalSteps,
    avgCadence: totalSteps / (totalTime / 60), // steps per minute
  };
  
  // Prepare distance-based metrics for visualization
  const distanceBasedMetrics = {
    distance: allSteps.map(s => s.distanceFromRunStartM || 0),
    speed: allSteps.map(s => s.speedMps || 0),
    stepLength: allSteps.map(s => s.stepLengthM),
    contactTime: allSteps.map(s => s.contactTimeSec),
    flightTime: allSteps.map(s => s.flightTimeSec),
  };
  
  return {
    run,
    segments: sortedSegments,
    allSteps,
    summary,
    distanceBasedMetrics
  };
}

/**
 * Generate segment configuration based on total distance and segment length
 */
export function generateSegments(
  runId: string,
  totalDistanceM: number,
  segmentLengthM: number
): RunSegment[] {
  const numSegments = Math.ceil(totalDistanceM / segmentLengthM);
  const segments: RunSegment[] = [];
  
  for (let i = 0; i < numSegments; i++) {
    segments.push({
      id: `${runId}_segment_${i}`,
      runId,
      segmentIndex: i,
      startDistanceM: i * segmentLengthM,
      endDistanceM: Math.min((i + 1) * segmentLengthM, totalDistanceM),
      fps: 60, // Default, will be updated
      status: 'pending'
    });
  }
  
  return segments;
}

/**
 * Validate that all segments have been uploaded
 */
export function validateSegmentUploads(segments: RunSegment[]): {
  isValid: boolean;
  missingSegments: number[];
} {
  const missingSegments = segments
    .filter(s => !s.videoFile && !s.videoFilePath)
    .map(s => s.segmentIndex);
  
  return {
    isValid: missingSegments.length === 0,
    missingSegments
  };
}

/**
 * Calculate overlap between adjacent segments (for future sync features)
 */
export function findOverlapFrames(
  segment1Result: SegmentAnalysisResult,
  segment2Result: SegmentAnalysisResult,
  overlapDistanceM: number = 2
): { segment1Steps: Step[], segment2Steps: Step[] } {
  // Find steps in the overlap zone
  const segment1Overlap = segment1Result.steps.filter(s => 
    s.distanceFromSegmentStartM >= (10 - overlapDistanceM)
  );
  
  const segment2Overlap = segment2Result.steps.filter(s => 
    s.distanceFromSegmentStartM <= overlapDistanceM
  );
  
  return {
    segment1Steps: segment1Overlap,
    segment2Steps: segment2Overlap
  };
}