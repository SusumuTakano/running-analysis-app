/**
 * H-FVP (Horizontal Force-Velocity Profile) Calculator
 * 
 * シングルカメラ走行分析から水平方向の力-速度プロファイルを計算
 */

export interface HFVPResult {
  // Core parameters
  F0: number;           // Maximum horizontal force (N)
  V0: number;           // Maximum velocity (m/s)
  Pmax: number;         // Maximum power (W)
  RFmax: number;        // Maximum ratio of force (%)
  DRF: number;          // Decrease in ratio of force (%/m/s)
  
  // Data points for visualization
  dataPoints: {
    velocity: number;     // m/s
    force: number;        // N
    power: number;        // W
    forceRatio: number;   // %
    distance: number;     // m
  }[];
  
  // Regression quality
  rSquared: number;       // Coefficient of determination
  
  // Summary
  summary: {
    avgForce: number;     // Average horizontal force (N)
    avgPower: number;     // Average power (W)
    peakVelocity: number; // Peak velocity in the run (m/s)
    acceleration: number; // Average acceleration (m/s²)
  };
}

export interface StepDataForHFVP {
  distanceAtContactM: number;
  speedMps: number | null;
  strideM: number | null;
  contactTimeS: number;
  flightTimeS: number;
}

/**
 * Calculate H-FVP from step data
 * 
 * @param steps - Array of step data from single-camera analysis
 * @param bodyMassKg - Athlete's body mass (kg)
 * @param athleteHeightM - Athlete's height (m) - optional, defaults to 1.75m
 * @returns HFVPResult
 */
export function calculateHFVP(
  steps: StepDataForHFVP[],
  bodyMassKg: number,
  athleteHeightM: number = 1.75
): HFVPResult | null {
  if (steps.length < 3) {
    console.warn('⚠️ Not enough steps for H-FVP calculation (minimum: 3)');
    return null;
  }
  
  if (bodyMassKg <= 0) {
    console.warn('⚠️ Invalid body mass for H-FVP calculation');
    return null;
  }
  
  console.log(`\n📊 === Calculating H-FVP ===`);
  console.log(`   Body mass: ${bodyMassKg.toFixed(1)} kg`);
  console.log(`   Height: ${athleteHeightM.toFixed(2)} m`);
  console.log(`   Steps: ${steps.length}`);
  
  const g = 9.81; // Gravity (m/s²)
  
  // Filter valid steps (with speed and stride)
  const validSteps = steps.filter(
    step => step.speedMps !== null && 
            step.speedMps > 0 && 
            step.strideM !== null && 
            step.strideM > 0
  );
  
  if (validSteps.length < 3) {
    console.warn('⚠️ Not enough valid steps with speed data');
    return null;
  }
  
  console.log(`   Valid steps: ${validSteps.length}`);
  
  // Calculate data points
  const dataPoints: HFVPResult['dataPoints'] = [];
  
  for (let i = 0; i < validSteps.length - 1; i++) {
    const step = validSteps[i];
    const nextStep = validSteps[i + 1];
    
    const velocity = step.speedMps!;
    const nextVelocity = nextStep.speedMps!;
    
    // Calculate acceleration
    const deltaT = step.contactTimeS + step.flightTimeS;
    const acceleration = (nextVelocity - velocity) / deltaT;
    
    // Calculate horizontal force
    // F = m * a (simplified model)
    const horizontalForce = bodyMassKg * acceleration;
    
    // Calculate power
    // P = F * v
    const power = horizontalForce * velocity;
    
    // Calculate force ratio
    // RF = F / (m * g)
    const forceRatio = (horizontalForce / (bodyMassKg * g)) * 100;
    
    dataPoints.push({
      velocity,
      force: horizontalForce,
      power,
      forceRatio,
      distance: step.distanceAtContactM,
    });
  }
  
  if (dataPoints.length < 3) {
    console.warn('⚠️ Not enough data points for regression');
    return null;
  }
  
  console.log(`   Data points: ${dataPoints.length}`);
  
  // Linear regression: Force = F0 - slope * velocity
  const { slope, intercept, rSquared } = linearRegression(
    dataPoints.map(p => p.velocity),
    dataPoints.map(p => p.force)
  );
  
  // F0: Maximum horizontal force (when velocity = 0)
  const F0 = intercept;
  
  // V0: Maximum velocity (when force = 0)
  // F = F0 - slope * V
  // 0 = F0 - slope * V0
  // V0 = F0 / slope
  const V0 = slope !== 0 ? F0 / Math.abs(slope) : 0;
  
  // Pmax: Maximum power = F0 * V0 / 4
  const Pmax = (F0 * V0) / 4;
  
  // RFmax: Maximum ratio of force (at start, when velocity is lowest)
  const RFmax = (F0 / (bodyMassKg * g)) * 100;
  
  // DRF: Decrease in ratio of force per unit velocity
  // DRF = (RF at v=0 - RF at v=V0) / V0
  // DRF = RFmax / V0
  const DRF = V0 !== 0 ? RFmax / V0 : 0;
  
  // Summary statistics
  const avgForce = dataPoints.reduce((sum, p) => sum + p.force, 0) / dataPoints.length;
  const avgPower = dataPoints.reduce((sum, p) => sum + p.power, 0) / dataPoints.length;
  const peakVelocity = Math.max(...validSteps.map(s => s.speedMps!));
  
  // Average acceleration (from first to last step)
  const firstVelocity = validSteps[0].speedMps!;
  const lastVelocity = validSteps[validSteps.length - 1].speedMps!;
  const totalTime = validSteps.reduce((sum, s) => sum + s.contactTimeS + s.flightTimeS, 0);
  const avgAcceleration = (lastVelocity - firstVelocity) / totalTime;
  
  console.log(`\n✅ H-FVP Results:`);
  console.log(`   F0: ${F0.toFixed(1)} N`);
  console.log(`   V0: ${V0.toFixed(2)} m/s`);
  console.log(`   Pmax: ${Pmax.toFixed(1)} W`);
  console.log(`   RFmax: ${RFmax.toFixed(1)} %`);
  console.log(`   DRF: ${DRF.toFixed(2)} %/m/s`);
  console.log(`   R²: ${rSquared.toFixed(3)}`);
  
  return {
    F0,
    V0,
    Pmax,
    RFmax,
    DRF,
    dataPoints,
    rSquared,
    summary: {
      avgForce,
      avgPower,
      peakVelocity,
      acceleration: avgAcceleration,
    },
  };
}

/**
 * Linear regression: y = intercept + slope * x
 */
function linearRegression(
  x: number[],
  y: number[]
): { slope: number; intercept: number; rSquared: number } {
  const n = x.length;
  
  if (n < 2) {
    return { slope: 0, intercept: 0, rSquared: 0 };
  }
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const meanX = sumX / n;
  const meanY = sumY / n;
  
  // Slope
  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumX2 - sumX * sumX;
  const slope = denominator !== 0 ? numerator / denominator : 0;
  
  // Intercept
  const intercept = meanY - slope * meanX;
  
  // R-squared
  const ssTotal = sumY2 - n * meanY * meanY;
  const ssResidual = y.reduce((sum, yi, i) => {
    const predicted = intercept + slope * x[i];
    const residual = yi - predicted;
    return sum + residual * residual;
  }, 0);
  
  const rSquared = ssTotal !== 0 ? 1 - (ssResidual / ssTotal) : 0;
  
  return { slope, intercept, rSquared };
}

/**
 * Format H-FVP results for display
 */
export function formatHFVPResults(hfvp: HFVPResult): string {
  return `
H-FVP Analysis Results
======================

Core Parameters:
- F0 (Maximum Force): ${hfvp.F0.toFixed(1)} N
- V0 (Maximum Velocity): ${hfvp.V0.toFixed(2)} m/s
- Pmax (Maximum Power): ${hfvp.Pmax.toFixed(1)} W
- RFmax (Maximum Force Ratio): ${hfvp.RFmax.toFixed(1)} %
- DRF (Force Decrease Rate): ${hfvp.DRF.toFixed(2)} %/m/s

Quality:
- R² (Regression): ${hfvp.rSquared.toFixed(3)}

Summary:
- Average Force: ${hfvp.summary.avgForce.toFixed(1)} N
- Average Power: ${hfvp.summary.avgPower.toFixed(1)} W
- Peak Velocity: ${hfvp.summary.peakVelocity.toFixed(2)} m/s
- Average Acceleration: ${hfvp.summary.acceleration.toFixed(2)} m/s²
`.trim();
}
