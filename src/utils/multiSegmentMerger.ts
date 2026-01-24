/**
 * Multi-Segment Merger
 * 
 * シングルカメラ解析の結果を統合
 * 各セグメントの距離にオフセットを適用して15m全体のデータを生成
 */

export interface SingleCameraResult {
  segmentId: string;
  segmentIndex: number;
  startDistanceM: number;
  endDistanceM: number;
  steps: Array<{
    index: number;
    contactFrame: number;
    toeOffFrame: number;
    contactTime: number;
    flightTime: number;
    stride: number | null;
    fullStride: number | null;
    distanceAtContact: number;
    speedMps: number | null;
    cadence: number | null;
    quality: string;
    isInterpolated: boolean;
  }>;
}

export interface MergedSegmentResult {
  totalDistanceM: number;
  totalSteps: number;
  realSteps: number;
  interpolatedSteps: number;
  avgStrideM: number;
  medianStrideM: number;
  avgSpeedMps: number;
  avgContactTimeS: number;
  avgFlightTimeS: number;
  totalTimeS: number;
  allSteps: Array<{
    globalIndex: number;
    segmentId: string;
    localIndex: number;
    contactFrame: number;
    toeOffFrame: number;
    contactTime: number;
    flightTime: number;
    stride: number | null;
    fullStride: number | null;
    distanceAtContact: number;
    speedMps: number | null;
    cadence: number | null;
    quality: string;
    isInterpolated: boolean;
  }>;
}

/**
 * セグメント結果を統合
 */
export function mergeSegmentResults(
  segmentResults: SingleCameraResult[]
): MergedSegmentResult {
  console.log('\n🔗 === Merging Segment Results ===');
  console.log(`   Total segments: ${segmentResults.length}`);
  
  // Sort by segment index
  const sortedResults = [...segmentResults].sort((a, b) => a.segmentIndex - b.segmentIndex);
  
  // Apply distance offset to each segment
  const allSteps: MergedSegmentResult['allSteps'] = [];
  let globalIndex = 0;
  
  sortedResults.forEach((segment, segIdx) => {
    const distanceOffset = segment.startDistanceM;
    console.log(`\n   📦 Segment ${segIdx + 1}: ${segment.startDistanceM}m - ${segment.endDistanceM}m`);
    console.log(`      Distance offset: +${distanceOffset}m`);
    console.log(`      Steps: ${segment.steps.length}`);
    
    segment.steps.forEach((step, localIdx) => {
      const adjustedDistance = step.distanceAtContact + distanceOffset;
      
      allSteps.push({
        globalIndex: globalIndex++,
        segmentId: segment.segmentId,
        localIndex: localIdx,
        contactFrame: step.contactFrame,
        toeOffFrame: step.toeOffFrame,
        contactTime: step.contactTime,
        flightTime: step.flightTime,
        stride: step.stride,
        fullStride: step.fullStride,
        distanceAtContact: adjustedDistance,
        speedMps: step.speedMps,
        cadence: step.cadence,
        quality: step.quality,
        isInterpolated: step.isInterpolated,
      });
      
      console.log(`      Step ${localIdx + 1}: ${step.distanceAtContact.toFixed(2)}m → ${adjustedDistance.toFixed(2)}m`);
    });
  });
  
  console.log(`\n   Total steps before deduplication: ${allSteps.length}`);
  
  // Sort by distance
  allSteps.sort((a, b) => a.distanceAtContact - b.distanceAtContact);
  
  // Remove boundary duplicates (steps within 0.5m of segment boundaries)
  const deduplicatedSteps = removeBoundaryDuplicates(allSteps, sortedResults);
  
  console.log(`   After deduplication: ${deduplicatedSteps.length} steps`);
  
  // Recalculate stride for adjacent steps
  recalculateStrides(deduplicatedSteps);
  
  // Calculate statistics
  const realSteps = deduplicatedSteps.filter(s => !s.isInterpolated);
  const interpolatedSteps = deduplicatedSteps.filter(s => s.isInterpolated);
  
  const totalTimeS = deduplicatedSteps.reduce((sum, s) => sum + s.contactTime + s.flightTime, 0);
  
  const validStrides = deduplicatedSteps
    .map(s => s.stride)
    .filter((s): s is number => s !== null && s > 0);
  
  const avgStrideM = validStrides.length > 0
    ? validStrides.reduce((sum, s) => sum + s, 0) / validStrides.length
    : 0;
  
  const sortedStrides = [...validStrides].sort((a, b) => a - b);
  const medianStrideM = sortedStrides.length > 0
    ? sortedStrides[Math.floor(sortedStrides.length / 2)]
    : 0;
  
  const totalDistanceM = sortedResults.reduce((sum, seg) => sum + (seg.endDistanceM - seg.startDistanceM), 0);
  const avgSpeedMps = totalTimeS > 0 ? totalDistanceM / totalTimeS : 0;
  
  const avgContactTimeS = realSteps.length > 0
    ? realSteps.reduce((sum, s) => sum + s.contactTime, 0) / realSteps.length
    : 0;
  
  const avgFlightTimeS = realSteps.length > 0
    ? realSteps.reduce((sum, s) => sum + s.flightTime, 0) / realSteps.length
    : 0;
  
  console.log('\n✅ Merge complete:');
  console.log(`   Total distance: ${totalDistanceM}m`);
  console.log(`   Total steps: ${deduplicatedSteps.length}`);
  console.log(`   Real steps: ${realSteps.length}`);
  console.log(`   Interpolated steps: ${interpolatedSteps.length}`);
  console.log(`   Average stride: ${avgStrideM.toFixed(3)}m`);
  console.log(`   Median stride: ${medianStrideM.toFixed(3)}m`);
  console.log(`   Average speed: ${avgSpeedMps.toFixed(2)}m/s`);
  
  return {
    totalDistanceM,
    totalSteps: deduplicatedSteps.length,
    realSteps: realSteps.length,
    interpolatedSteps: interpolatedSteps.length,
    avgStrideM,
    medianStrideM,
    avgSpeedMps,
    avgContactTimeS,
    avgFlightTimeS,
    totalTimeS,
    allSteps: deduplicatedSteps,
  };
}

/**
 * 境界付近の重複を除去
 */
function removeBoundaryDuplicates(
  allSteps: MergedSegmentResult['allSteps'],
  segments: SingleCameraResult[]
): MergedSegmentResult['allSteps'] {
  if (segments.length < 2) return allSteps;
  
  console.log('\n🔍 Removing boundary duplicates...');
  
  const boundaryTolerance = 0.5; // ±0.5m
  const toRemove = new Set<number>();
  
  // Check each boundary
  for (let i = 1; i < segments.length; i++) {
    const boundaryPos = segments[i].startDistanceM;
    console.log(`\n   Boundary at ${boundaryPos}m:`);
    
    // Find steps near this boundary
    const nearbySteps = allSteps
      .map((step, idx) => ({ step, idx }))
      .filter(({ step }) => Math.abs(step.distanceAtContact - boundaryPos) < boundaryTolerance);
    
    if (nearbySteps.length > 1) {
      console.log(`   Found ${nearbySteps.length} steps near boundary:`);
      nearbySteps.forEach(({ step }) => {
        console.log(`      - ${step.distanceAtContact.toFixed(3)}m (Segment: ${step.segmentId})`);
      });
      
      // Keep the step closest to the boundary
      const sorted = [...nearbySteps].sort((a, b) => {
        const distA = Math.abs(a.step.distanceAtContact - boundaryPos);
        const distB = Math.abs(b.step.distanceAtContact - boundaryPos);
        return distA - distB;
      });
      
      const keep = sorted[0];
      const remove = sorted.slice(1);
      
      console.log(`   ✅ Keep: ${keep.step.distanceAtContact.toFixed(3)}m`);
      remove.forEach(({ step, idx }) => {
        console.log(`   ❌ Remove: ${step.distanceAtContact.toFixed(3)}m`);
        toRemove.add(idx);
      });
    }
  }
  
  return allSteps.filter((_, idx) => !toRemove.has(idx));
}

/**
 * ストライドを再計算
 */
function recalculateStrides(steps: MergedSegmentResult['allSteps']): void {
  console.log('\n📏 Recalculating strides...');
  
  for (let i = 0; i < steps.length - 1; i++) {
    const stride = steps[i + 1].distanceAtContact - steps[i].distanceAtContact;
    steps[i].stride = stride;
    
    const stepTime = steps[i].contactTime + steps[i].flightTime;
    if (stepTime > 0) {
      steps[i].speedMps = stride / stepTime;
    }
    
    console.log(`   Step ${i + 1}: ${steps[i].distanceAtContact.toFixed(2)}m → ${steps[i + 1].distanceAtContact.toFixed(2)}m = ${stride.toFixed(3)}m`);
  }
  
  // Last step has no stride
  if (steps.length > 0) {
    steps[steps.length - 1].stride = null;
  }
}
