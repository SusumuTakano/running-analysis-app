import { RunSegment, CombinedStepData } from '../types/multiCamera';

/**
 * 各セグメントのステップデータを結合して、0-100mの連続データとして返す
 */
export function combineSegmentSteps(
  segments: RunSegment[],
  segmentStepsMap: Map<string, any[]> // sessionId -> steps array
): CombinedStepData[] {
  const combinedSteps: CombinedStepData[] = [];

  // セグメントをインデックス順にソート
  const sortedSegments = [...segments].sort((a, b) => a.segmentIndex - b.segmentIndex);

  for (const segment of sortedSegments) {
    if (!segment.sessionId) continue;

    const steps = segmentStepsMap.get(segment.sessionId);
    if (!steps || !Array.isArray(steps)) continue;

    // 各ステップにグローバル距離を追加
    for (const step of steps) {
      const combinedStep: CombinedStepData = {
        globalDistanceM: segment.startDistanceM + (step.distance || 0),
        segmentIndex: segment.segmentIndex,
        localDistanceM: step.distance || 0,
        strideLength: step.strideLength || 0,
        contactTime: step.contactTime || 0,
        flightTime: step.flightTime || 0,
        timestamp: step.timestamp || 0
      };

      // 関節角度があれば追加
      if (step.jointAngles) {
        combinedStep.jointAngles = {
          hip: step.jointAngles.hip || 0,
          knee: step.jointAngles.knee || 0,
          ankle: step.jointAngles.ankle || 0
        };
      }

      combinedSteps.push(combinedStep);
    }
  }

  // グローバル距離でソート
  combinedSteps.sort((a, b) => a.globalDistanceM - b.globalDistanceM);

  return combinedSteps;
}

/**
 * セグメント間のデータを補間して滑らかに繋げる
 */
export function interpolateSegmentTransitions(
  combinedSteps: CombinedStepData[],
  transitionWindow: number = 1.0 // メートル単位
): CombinedStepData[] {
  const interpolatedSteps = [...combinedSteps];
  
  // セグメント境界を見つける
  for (let i = 1; i < interpolatedSteps.length; i++) {
    const prevStep = interpolatedSteps[i - 1];
    const currStep = interpolatedSteps[i];
    
    // セグメントが変わった場合
    if (prevStep.segmentIndex !== currStep.segmentIndex) {
      const distanceGap = currStep.globalDistanceM - prevStep.globalDistanceM;
      
      // ギャップが大きい場合は補間
      if (distanceGap > transitionWindow) {
        // 線形補間でストライド長を調整
        const avgStrideLength = (prevStep.strideLength + currStep.strideLength) / 2;
        currStep.strideLength = avgStrideLength;
      }
    }
  }
  
  return interpolatedSteps;
}

/**
 * マルチカメラデータの統計情報を計算
 */
export function calculateMultiCameraStats(combinedSteps: CombinedStepData[]) {
  if (combinedSteps.length === 0) {
    return {
      totalDistance: 0,
      avgStrideLength: 0,
      avgContactTime: 0,
      avgFlightTime: 0,
      segmentStats: []
    };
  }

  const totalDistance = combinedSteps[combinedSteps.length - 1].globalDistanceM;
  const avgStrideLength = combinedSteps.reduce((sum, step) => sum + step.strideLength, 0) / combinedSteps.length;
  const avgContactTime = combinedSteps.reduce((sum, step) => sum + step.contactTime, 0) / combinedSteps.length;
  const avgFlightTime = combinedSteps.reduce((sum, step) => sum + step.flightTime, 0) / combinedSteps.length;

  // セグメントごとの統計
  const segmentGroups = new Map<number, CombinedStepData[]>();
  for (const step of combinedSteps) {
    if (!segmentGroups.has(step.segmentIndex)) {
      segmentGroups.set(step.segmentIndex, []);
    }
    segmentGroups.get(step.segmentIndex)!.push(step);
  }

  const segmentStats = Array.from(segmentGroups.entries()).map(([index, steps]) => ({
    segmentIndex: index,
    stepCount: steps.length,
    avgStrideLength: steps.reduce((sum, s) => sum + s.strideLength, 0) / steps.length,
    avgContactTime: steps.reduce((sum, s) => sum + s.contactTime, 0) / steps.length,
    avgFlightTime: steps.reduce((sum, s) => sum + s.flightTime, 0) / steps.length
  }));

  return {
    totalDistance,
    avgStrideLength,
    avgContactTime,
    avgFlightTime,
    segmentStats
  };
}

/**
 * 既存の解析セッションデータをマルチカメラ用に変換
 */
export function convertSessionToSegmentSteps(
  sessionData: any, // 既存のセッション型
  segmentOffset: number = 0
): any[] {
  if (!sessionData || !sessionData.steps) {
    return [];
  }

  // 各ステップに距離オフセットを追加
  return sessionData.steps.map((step: any) => ({
    ...step,
    distance: (step.distance || 0) + segmentOffset
  }));
}