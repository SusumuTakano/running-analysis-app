/**
 * Multi-Camera Analysis Core Logic
 * Pure functions for segment analysis and merging
 */

import {
  SegmentRawData,
  SegmentAnalysisResult,
  StepData,
  MergedAnalysisResult,
  BoundaryStepGroup,
  Warning,
  CalibrationData,
  FramePoseData,
} from '../../components/MultiCamera/types';

/**
 * Apply Homography transformation to convert pixel coordinates to world coordinates
 */
export function applyHomography(
  H: number[][],
  pixelX: number,
  pixelY: number
): [number, number] {
  const x = H[0][0] * pixelX + H[0][1] * pixelY + H[0][2];
  const y = H[1][0] * pixelX + H[1][1] * pixelY + H[1][2];
  const w = H[2][0] * pixelX + H[2][1] * pixelY + H[2][2];
  
  if (Math.abs(w) < 1e-12) {
    console.warn('⚠️ Homography division by near-zero');
    return [NaN, NaN];
  }
  
  return [x / w, y / w];
}

/**
 * Get foot pixel coordinates at contact frame
 */
function getFootPixelCoordinates(
  poseData: FramePoseData,
  videoWidth: number,
  videoHeight: number
): { x: number; y: number } {
  const landmarks = poseData.landmarks;
  
  // Left foot: ankle(27), toe(31)
  const leftAnkle = landmarks[27];
  const leftToe = landmarks[31];
  // Right foot: ankle(28), toe(32)
  const rightAnkle = landmarks[28];
  const rightToe = landmarks[32];
  
  // Choose the foot with higher Y (closer to ground in image)
  const leftY = Math.max(leftAnkle.y, leftToe.y);
  const rightY = Math.max(rightAnkle.y, rightToe.y);
  
  let footX: number, footY: number;
  if (leftY > rightY) {
    // Left foot is grounded
    footX = (leftAnkle.x + leftToe.x) / 2;
    footY = leftY;
  } else {
    // Right foot is grounded
    footX = (rightAnkle.x + rightToe.x) / 2;
    footY = rightY;
  }
  
  // Convert normalized coordinates (0-1) to pixel coordinates
  const pixelX = footX * videoWidth;
  const pixelY = footY * videoHeight;
  
  return { x: pixelX, y: pixelY };
}

/**
 * Analyze a single segment
 * Pure function: takes raw data, returns analysis result
 */
export function analyzeSegment(
  segmentData: SegmentRawData
): SegmentAnalysisResult {
  console.log(`\n🔍 === Analyzing Segment ${segmentData.segmentIndex + 1} ===`);
  console.log(`   Range: ${segmentData.startDistanceM}m - ${segmentData.endDistanceM}m`);
  console.log(`   Contact frames: ${segmentData.contactFrames.length}`);
  
  const steps: StepData[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Validation
  if (!segmentData.calibration) {
    errors.push('No calibration data available');
    return createErrorResult(segmentData, errors);
  }
  
  if (segmentData.contactFrames.length === 0) {
    warnings.push('No contact frames marked');
    return createEmptyResult(segmentData, warnings);
  }
  
  const H = segmentData.calibration.H_img_to_world;
  const videoWidth = segmentData.calibration.videoWidth;
  const videoHeight = segmentData.calibration.videoHeight;
  const fps = segmentData.fps;
  
  // Process each contact frame
  for (let i = 0; i < segmentData.contactFrames.length; i++) {
    const contactFrame = segmentData.contactFrames[i];
    const toeOffFrame = segmentData.toeOffFrames[i] || contactFrame + 10; // Default toe-off
    
    const poseData = segmentData.poseResults[contactFrame];
    if (!poseData) {
      warnings.push(`Frame ${contactFrame}: No pose data`);
      continue;
    }
    
    // Get foot pixel coordinates
    const footPixel = getFootPixelCoordinates(poseData, videoWidth, videoHeight);
    
    // Apply Homography to get world coordinates
    const [worldX, worldY] = applyHomography(H, footPixel.x, footPixel.y);
    
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
      warnings.push(`Frame ${contactFrame}: Invalid Homography result`);
      continue;
    }
    
    // worldX is the distance along the track
    const distanceAtContactM = worldX;
    
    // Calculate contact and flight times
    const nextContactFrame = segmentData.contactFrames[i + 1] || toeOffFrame + 10;
    const contactTimeS = (toeOffFrame - contactFrame) / fps;
    const flightTimeS = (nextContactFrame - toeOffFrame) / fps;
    
    const step: StepData = {
      stepId: `${segmentData.id}_step_${i}`,
      segmentId: segmentData.id,
      localStepIndex: i,
      
      contactFrame,
      toeOffFrame,
      
      distanceAtContactM,
      strideM: null, // Will be calculated during merge
      
      contactTimeS,
      flightTimeS,
      
      speedMps: null,
      cadence: null,
      
      isInterpolated: false,
      quality: 'good',
      
      footPixelX: footPixel.x,
      footPixelY: footPixel.y,
    };
    
    steps.push(step);
    
    console.log(`   Step ${i}: Frame ${contactFrame} → ${distanceAtContactM.toFixed(3)}m (pixel: ${footPixel.x.toFixed(0)}, ${footPixel.y.toFixed(0)})`);
  }
  
  // Sort steps by distance
  steps.sort((a, b) => a.distanceAtContactM - b.distanceAtContactM);
  
  // Calculate summary statistics
  const avgStrideM = 0; // Will be calculated after merge
  const avgSpeedMps = 0;
  const avgContactTimeS = steps.length > 0
    ? steps.reduce((sum, s) => sum + s.contactTimeS, 0) / steps.length
    : 0;
  const avgFlightTimeS = steps.length > 0
    ? steps.reduce((sum, s) => sum + s.flightTimeS, 0) / steps.length
    : 0;
  
  const successfulPoseFrames = segmentData.poseResults.filter(p => p !== null).length;
  
  console.log(`   ✅ Detected ${steps.length} steps`);
  if (steps.length > 0) {
    console.log(`   📏 Distance range: ${steps[0].distanceAtContactM.toFixed(2)}m - ${steps[steps.length - 1].distanceAtContactM.toFixed(2)}m`);
  }
  
  return {
    segmentId: segmentData.id,
    segmentIndex: segmentData.segmentIndex,
    steps,
    summary: {
      totalSteps: steps.length,
      avgStrideM,
      avgSpeedMps,
      avgContactTimeS,
      avgFlightTimeS,
    },
    metadata: {
      fps: segmentData.fps,
      totalFrames: segmentData.totalFrames,
      successfulPoseFrames,
      calibrationQuality: segmentData.calibration.quality,
    },
    validation: {
      isValid: errors.length === 0 && steps.length > 0,
      warnings,
      errors,
    },
  };
}

function createErrorResult(
  segmentData: SegmentRawData,
  errors: string[]
): SegmentAnalysisResult {
  return {
    segmentId: segmentData.id,
    segmentIndex: segmentData.segmentIndex,
    steps: [],
    summary: {
      totalSteps: 0,
      avgStrideM: 0,
      avgSpeedMps: 0,
      avgContactTimeS: 0,
      avgFlightTimeS: 0,
    },
    metadata: {
      fps: segmentData.fps,
      totalFrames: segmentData.totalFrames,
      successfulPoseFrames: 0,
      calibrationQuality: 0,
    },
    validation: {
      isValid: false,
      warnings: [],
      errors,
    },
  };
}

function createEmptyResult(
  segmentData: SegmentRawData,
  warnings: string[]
): SegmentAnalysisResult {
  return {
    segmentId: segmentData.id,
    segmentIndex: segmentData.segmentIndex,
    steps: [],
    summary: {
      totalSteps: 0,
      avgStrideM: 0,
      avgSpeedMps: 0,
      avgContactTimeS: 0,
      avgFlightTimeS: 0,
    },
    metadata: {
      fps: segmentData.fps,
      totalFrames: segmentData.totalFrames,
      successfulPoseFrames: 0,
      calibrationQuality: segmentData.calibration?.quality || 0,
    },
    validation: {
      isValid: false,
      warnings,
      errors: [],
    },
  };
}

/**
 * Merge multiple segment results into a single continuous run
 */
export function mergeSegments(
  segmentResults: SegmentAnalysisResult[],
  totalDistanceM: number,
  segmentLengthM: number
): MergedAnalysisResult {
  console.log(`\n🔗 === Merging ${segmentResults.length} Segments ===`);
  
  // Sort by segment index
  const sortedResults = [...segmentResults].sort(
    (a, b) => a.segmentIndex - b.segmentIndex
  );
  
  // Collect all steps
  let allSteps: StepData[] = [];
  sortedResults.forEach(result => {
    allSteps.push(...result.steps);
  });
  
  console.log(`   Total steps before merge: ${allSteps.length}`);
  
  // Sort by distance
  allSteps.sort((a, b) => a.distanceAtContactM - b.distanceAtContactM);
  
  // Step 1: Detect boundary duplicates
  const boundaries = detectBoundaryDuplicates(allSteps, segmentResults, segmentLengthM);
  
  // Step 2: Remove duplicates (keep only selected steps)
  const deduplicatedSteps = removeBoundaryDuplicates(allSteps, boundaries);
  
  console.log(`   After deduplication: ${deduplicatedSteps.length} steps`);
  
  // Step 3: Calculate median stride for gap detection
  const medianStrideM = calculateMedianStride(deduplicatedSteps);
  console.log(`   Median stride: ${medianStrideM.toFixed(3)}m`);
  
  // Step 4: Detect and interpolate gaps
  const { steps: finalSteps, warnings } = interpolateGaps(
    deduplicatedSteps,
    medianStrideM
  );
  
  console.log(`   After interpolation: ${finalSteps.length} steps`);
  
  // Step 5: Calculate stride for each step
  calculateStrides(finalSteps);
  
  // Step 6: Assign global indices
  finalSteps.forEach((step, idx) => {
    step.globalStepIndex = idx;
  });
  
  // Calculate summary statistics
  const realSteps = finalSteps.filter(s => !s.isInterpolated);
  const interpolatedSteps = finalSteps.filter(s => s.isInterpolated);
  
  const totalTimeS = finalSteps.reduce(
    (sum, s) => sum + s.contactTimeS + s.flightTimeS,
    0
  );
  
  const validStrides = realSteps
    .map(s => s.strideM)
    .filter((s): s is number => s !== null && s > 0);
  
  const avgStrideM = validStrides.length > 0
    ? validStrides.reduce((sum, s) => sum + s, 0) / validStrides.length
    : 0;
  
  const avgSpeedMps = totalTimeS > 0 ? totalDistanceM / totalTimeS : 0;
  const avgCadence = totalTimeS > 0 ? (realSteps.length / (totalTimeS / 60)) : 0;
  
  console.log(`\n✅ Merge complete:`);
  console.log(`   Total steps: ${finalSteps.length}`);
  console.log(`   Real steps: ${realSteps.length}`);
  console.log(`   Interpolated steps: ${interpolatedSteps.length}`);
  console.log(`   Average stride: ${avgStrideM.toFixed(3)}m`);
  console.log(`   Median stride: ${medianStrideM.toFixed(3)}m`);
  console.log(`   Average speed: ${avgSpeedMps.toFixed(2)}m/s`);
  
  return {
    allSteps: finalSteps,
    summary: {
      totalDistanceM,
      totalSteps: finalSteps.length,
      realSteps: realSteps.length,
      interpolatedSteps: interpolatedSteps.length,
      totalTimeS,
      avgSpeedMps,
      avgStrideM,
      avgCadence,
      medianStrideM,
    },
    boundaries,
    warnings,
    errors: [],
  };
}

/**
 * Detect steps near segment boundaries
 */
function detectBoundaryDuplicates(
  allSteps: StepData[],
  segmentResults: SegmentAnalysisResult[],
  segmentLengthM: number
): BoundaryStepGroup[] {
  console.log(`\n🔍 Detecting boundary duplicates...`);
  
  const boundaries: BoundaryStepGroup[] = [];
  const boundaryTolerance = 0.5; // ±0.5m tolerance
  
  // Generate boundary positions (5m, 10m, etc.)
  const boundaryPositions: number[] = [];
  for (let i = 1; i < segmentResults.length; i++) {
    boundaryPositions.push(i * segmentLengthM);
  }
  
  console.log(`   Boundary positions: ${boundaryPositions.map(p => p.toFixed(1) + 'm').join(', ')}`);
  
  // For each boundary, find nearby steps
  boundaryPositions.forEach(boundaryPos => {
    const nearbySteps = allSteps.filter(step => {
      const dist = step.distanceAtContactM;
      return Math.abs(dist - boundaryPos) < boundaryTolerance;
    });
    
    if (nearbySteps.length > 1) {
      console.log(`   🔍 Found ${nearbySteps.length} steps near ${boundaryPos.toFixed(1)}m:`);
      nearbySteps.forEach(step => {
        console.log(`      - ${step.distanceAtContactM.toFixed(3)}m (Segment: ${step.segmentId})`);
      });
      
      // Select the step closest to the boundary
      const sortedByProximity = [...nearbySteps].sort((a, b) => {
        const distA = Math.abs(a.distanceAtContactM - boundaryPos);
        const distB = Math.abs(b.distanceAtContactM - boundaryPos);
        return distA - distB;
      });
      
      const selectedStep = sortedByProximity[0];
      const duplicates = sortedByProximity.slice(1);
      
      console.log(`      ✅ Selected: ${selectedStep.distanceAtContactM.toFixed(3)}m`);
      duplicates.forEach(dup => {
        console.log(`      ❌ Duplicate: ${dup.distanceAtContactM.toFixed(3)}m`);
      });
      
      boundaries.push({
        boundaryPositionM: boundaryPos,
        steps: nearbySteps,
        selectedStep,
        duplicates,
      });
    }
  });
  
  return boundaries;
}

/**
 * Remove boundary duplicates from step list
 */
function removeBoundaryDuplicates(
  allSteps: StepData[],
  boundaries: BoundaryStepGroup[]
): StepData[] {
  const duplicateIds = new Set<string>();
  
  boundaries.forEach(boundary => {
    boundary.duplicates.forEach(dup => {
      duplicateIds.add(dup.stepId);
    });
  });
  
  return allSteps.filter(step => !duplicateIds.has(step.stepId));
}

/**
 * Calculate median stride from valid steps
 */
function calculateMedianStride(steps: StepData[]): number {
  const strides: number[] = [];
  
  for (let i = 0; i < steps.length - 1; i++) {
    const stride = steps[i + 1].distanceAtContactM - steps[i].distanceAtContactM;
    if (stride > 0.5 && stride < 3.0) {
      strides.push(stride);
    }
  }
  
  if (strides.length === 0) {
    return 1.6; // Default fallback
  }
  
  strides.sort((a, b) => a - b);
  return strides[Math.floor(strides.length / 2)];
}

/**
 * Interpolate missing steps in large gaps
 */
function interpolateGaps(
  steps: StepData[],
  medianStrideM: number
): { steps: StepData[]; warnings: Warning[] } {
  console.log(`\n🔧 Interpolating gaps (median stride: ${medianStrideM.toFixed(3)}m)...`);
  
  const result: StepData[] = [];
  const warnings: Warning[] = [];
  const gapThreshold = medianStrideM * 1.5;
  
  for (let i = 0; i < steps.length; i++) {
    result.push(steps[i]);
    
    if (i < steps.length - 1) {
      const gap = steps[i + 1].distanceAtContactM - steps[i].distanceAtContactM;
      
      if (gap > gapThreshold) {
        const missingSteps = Math.round(gap / medianStrideM) - 1;
        
        console.log(`   🔶 Gap detected: ${gap.toFixed(2)}m between ${steps[i].distanceAtContactM.toFixed(2)}m and ${steps[i + 1].distanceAtContactM.toFixed(2)}m`);
        console.log(`      Interpolating ${missingSteps} steps...`);
        
        for (let j = 1; j <= missingSteps; j++) {
          const interpolatedDistance = steps[i].distanceAtContactM + (medianStrideM * j);
          
          const interpolatedStep: StepData = {
            ...steps[i],
            stepId: `interpolated_${i}_${j}`,
            distanceAtContactM: interpolatedDistance,
            strideM: medianStrideM,
            isInterpolated: true,
            quality: 'warning',
          };
          
          result.push(interpolatedStep);
          console.log(`      ➕ Interpolated step at ${interpolatedDistance.toFixed(2)}m`);
        }
        
        warnings.push({
          type: 'gap',
          message: `Gap of ${gap.toFixed(2)}m detected, ${missingSteps} steps interpolated`,
          severity: 'medium',
        });
      }
    }
  }
  
  return { steps: result, warnings };
}

/**
 * Calculate stride for each step (distance to next step)
 */
function calculateStrides(steps: StepData[]): void {
  console.log(`\n📏 Calculating strides...`);
  
  // Only calculate for real (non-interpolated) steps
  const realSteps = steps.filter(s => !s.isInterpolated);
  
  for (let i = 0; i < realSteps.length - 1; i++) {
    const stride = realSteps[i + 1].distanceAtContactM - realSteps[i].distanceAtContactM;
    realSteps[i].strideM = stride;
    
    // Calculate speed if we have step time
    const stepTime = realSteps[i].contactTimeS + realSteps[i].flightTimeS;
    if (stepTime > 0) {
      realSteps[i].speedMps = stride / stepTime;
    }
    
    // Flag anomalies
    if (stride < 0.6 || stride > 2.5) {
      realSteps[i].quality = 'warning';
      console.log(`   ⚠️ Step ${i}: Unusual stride ${stride.toFixed(3)}m`);
    } else {
      console.log(`   ✅ Step ${i}: Stride ${stride.toFixed(3)}m`);
    }
  }
  
  // Last step has no stride
  if (realSteps.length > 0) {
    realSteps[realSteps.length - 1].strideM = null;
  }
}
