// 固定カメラで測定したトップスピード(最大疾走スピード Vmax)から、100mタイムを3パターン予測する。
//
// ■ 中心となる経験式（実データ回帰・男女別）
//   男子: 最大疾走スピード = (記録 - 18.58) / -0.737  →  記録 = 18.58 - 0.737 × Vmax
//   女子: 最大疾走スピード = (記録 - 21.92) / -1.048  →  記録 = 21.92 - 1.048 × Vmax
//   （出典の表より。記録は公式100mタイム[s]、Vmaxは最大疾走スピード[m/s]）
//
// ■ ストライド = Vmax ÷ ピッチ。表の基準ピッチ（平均±SD）:
//   男子: 4.66 / 4.84 / 5.03 (歩/秒)、女子: 4.44 / 4.65 / 4.86 (歩/秒)
//
// ■ 3パターン
//   中間型 = 経験式そのもの（最も信頼できる中心予測）
//   前半型 = 早く最高速に達するが終盤失速 → 同じ最高速なら経験式よりやや遅い (+offset)
//   後半型 = 最高速をよく維持し終盤に強い → 同じ最高速なら経験式よりやや速い (-offset)
//   速度カーブ（velocity vs distance）は形状イメージとして物理モデルで生成（ピークはVmax）。

export type Sex = 'male' | 'female';
export type SpeedPatternKey = 'front' | 'middle' | 'back';

export interface SpeedSplit {
  distance: number;  // m
  time: number;      // s（スタートからの累積、headlineタイムに整合）
  velocity: number;  // m/s（カーブ形状用、ピーク≒Vmax）
}

export interface SpeedPattern {
  key: SpeedPatternKey;
  label: string;
  description: string;
  time100: number;        // 予測100mタイム[s]（公式相当）
  splits: SpeedSplit[];   // 10m毎（time は headline に整合するようスケール）
  curve: SpeedSplit[];    // velocity vs distance（形状イメージ）
  peakDistance: number;   // 最高速到達距離の目安[m]
}

export interface Predict100mResult {
  vmax: number;
  sex: Sex;
  centralTime: number;             // 経験式による中心予測
  patterns: SpeedPattern[];
  strideByPitch: { pitch: number; stride: number }[];
  formula: string;
}

// 同じ最高速でも前半型/後半型でこの程度ばらつく、という前提オフセット[s]（調整可能）
const PATTERN_OFFSET: Record<SpeedPatternKey, number> = { front: +0.12, middle: 0, back: -0.12 };

const PATTERN_META: { key: SpeedPatternKey; label: string; description: string; tau: number; aDec: number }[] = [
  { key: 'front',  label: '前半型', description: '加速が速く早めに最高速へ。終盤は失速しやすい', tau: 1.00, aDec: 0.22 },
  { key: 'middle', label: '中間型', description: '標準的な加速と維持（経験式の中心予測）', tau: 1.20, aDec: 0.10 },
  { key: 'back',   label: '後半型', description: '加速はゆるやかだが最高速をよく維持。終盤に強い', tau: 1.45, aDec: 0.03 },
];

const PITCH_REF: Record<Sex, number[]> = {
  male: [4.66, 4.84, 5.03],
  female: [4.44, 4.65, 4.86],
};

/** 経験式: 最大疾走スピード[m/s] → 100m公式タイム[s] */
export function empirical100mTime(vmax: number, sex: Sex): number {
  return sex === 'female' ? 21.92 - 1.048 * vmax : 18.58 - 0.737 * vmax;
}

/** 経験式の逆算: 100mタイム[s] → 最大疾走スピード[m/s]（参考用） */
export function vmaxFrom100m(time: number, sex: Sex): number {
  return sex === 'female' ? (time - 21.92) / -1.048 : (time - 18.58) / -0.737;
}

// 速度カーブの形状を物理モデルで生成（ピークはVmax）。timeは後でheadlineにスケールする。
function simulateShape(vmax: number, tau: number, aDec: number): { runTime: number; splits: SpeedSplit[]; curve: SpeedSplit[]; peakDistance: number } {
  const dt = 0.005;
  let x = 0, t = 0, v = 0;
  let peaked = false, tPeak = 0, peakDistance = 0, vPeak = vmax;
  const splitTargets = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const splits: SpeedSplit[] = [];
  const curve: SpeedSplit[] = [];
  let si = 0, guard = 0;
  const vFloor = vmax * 0.6;
  let prevX = 0, prevT = 0, prevV = 0;

  while (x < 100 && guard < 200000) {
    guard++;
    if (!peaked) {
      v = vmax * (1 - Math.exp(-t / tau));
      if (v >= 0.99 * vmax) { peaked = true; tPeak = t; peakDistance = x; vPeak = v; }
    } else {
      v = Math.max(vFloor, vPeak - aDec * (t - tPeak));
    }
    while (si < splitTargets.length && x >= splitTargets[si]) {
      const denom = (x - prevX) || 1;
      const frac = (splitTargets[si] - prevX) / denom;
      splits.push({ distance: splitTargets[si], time: prevT + frac * (t - prevT), velocity: prevV + frac * (v - prevV) });
      si++;
    }
    if (curve.length === 0 || x - curve[curve.length - 1].distance >= 2) {
      curve.push({ distance: Math.round(x * 10) / 10, velocity: v, time: t });
    }
    prevX = x; prevT = t; prevV = v;
    x += v * dt;
    t += dt;
  }
  let runTime: number;
  const last = splits[splits.length - 1];
  if (last && last.distance === 100) runTime = last.time;
  else {
    const denom = (x - prevX) || 1;
    const frac = (100 - prevX) / denom;
    runTime = prevT + frac * (t - prevT);
    splits.push({ distance: 100, time: runTime, velocity: v });
  }
  return { runTime, splits, curve, peakDistance };
}

/** 最大疾走スピード Vmax[m/s] と 性別から 100m を 3パターン予測する。非現実値なら null。 */
export function predict100m(vmax: number, sex: Sex): Predict100mResult | null {
  if (!Number.isFinite(vmax) || vmax < 5 || vmax > 14) return null;

  const centralTime = empirical100mTime(vmax, sex);

  const patterns: SpeedPattern[] = PATTERN_META.map((p) => {
    const target = centralTime + PATTERN_OFFSET[p.key]; // headline 100m タイム
    const sim = simulateShape(vmax, p.tau, p.aDec);
    const k = sim.runTime > 0 ? target / sim.runTime : 1; // 形状の時間をheadlineに合わせてスケール
    return {
      key: p.key,
      label: p.label,
      description: p.description,
      time100: target,
      splits: sim.splits.map((s) => ({ distance: s.distance, time: s.time * k, velocity: s.velocity })),
      curve: sim.curve,
      peakDistance: sim.peakDistance,
    };
  });

  const strideByPitch = PITCH_REF[sex].map((pitch) => ({ pitch, stride: vmax / pitch }));

  const formula = sex === 'female'
    ? '記録 = 21.92 − 1.048 × 最大疾走スピード（女子・実データ回帰）'
    : '記録 = 18.58 − 0.737 × 最大疾走スピード（男子・実データ回帰）';

  return { vmax, sex, centralTime, patterns, strideByPitch, formula };
}
