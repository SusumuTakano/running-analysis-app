// src/lib/hfvpExpo.ts
// H-FVP 高精度版: Samozino ら (2016) の単調指数モデルによるスプリントF-Vプロファイル推定
//
//   v(t) = Vmax · (1 − e^(−(t−t0)/τ))
//   x(t) = Vmax · ((t−t0) + τ·e^(−(t−t0)/τ) − τ)
//
// を「位置の実測点（スプリット通過＋接地位置）」に最小二乗フィットし、
// 連続モデルから加速度・力（空気抵抗込み）を導出して F-v 直線を得る。
// 従来の区間平均速度＋差分加速度と違い、タイム誤差がそのまま加速度誤差に増幅されない。
//
// 参考: Samozino et al. (2016) "A simple method for measuring power, force,
//       velocity properties, and mechanical effectiveness in sprint running"

export interface ExpoPoint {
  /** 経過時間[s]（基準は任意。t0をフィットするためスタート時刻不明でもよい） */
  t: number;
  /** スタートライン(0m)からの距離[m] */
  x: number;
  /** 重み（スプリット=3, 接地位置=1 など。省略時1） */
  w?: number;
  /** 表示用ラベル（"5mポール" / "接地F736" など） */
  label?: string;
}

export interface ExpoFit {
  vmax: number;      // 漸近最大速度 [m/s]
  tau: number;       // 時定数 [s]
  t0: number;        // 走り出し時刻（入力tと同じ基準）[s]
  posR2: number;     // 位置フィット決定係数
  rmse: number;      // 位置残差RMSE [m]
  residuals: Array<{ label: string; t: number; x: number; predicted: number; residual: number }>;
  usedPoints: number;
  droppedDecel: number; // 減速相として除外した点数
}

export interface ExpoHFVP {
  method: 'expo';
  fit: ExpoFit;
  f0N: number;
  f0RelNkg: number;
  v0: number;              // F=0 となる理論最大速度 [m/s]
  slopeFV: number;         // F-v傾き（相対, N·s/m/kg, 負値）
  pmaxW: number;
  pmaxRelWkg: number;
  vmaxMeasured: number;    // データ範囲内の最高モデル速度
  rfMax: number;           // %（最初の0.3s以降の最大RF）
  drf: number;             // RF-v傾き [%/(m/s)]
  fvR2: number;
  warnings: string[];
  grade: '良' | '可' | '参考';
  /** シミュレーション用の抗力パラメータ */
  kAero: number;           // 0.5·ρ·Cd·Af [N/(m/s)²]
  massKg: number;
}

const RHO = 1.225;   // 空気密度 [kg/m³]
const CD = 0.9;      // 抗力係数（Samozino 2016）
const G = 9.81;

/** 前面投影面積 [m²]（体表面積DuBois×0.266, Samozino 2016） */
export const frontalArea = (heightM: number, massKg: number): number =>
  0.2025 * Math.pow(heightM, 0.725) * Math.pow(massKg, 0.425) * 0.266;

/** 与えられた (τ, t0) に対する最適Vmax（重み付き閉形式）と残差二乗和 */
const solveVmax = (
  pts: ExpoPoint[], tau: number, t0: number
): { vmax: number; sse: number } => {
  let num = 0, den = 0;
  const gs: number[] = [];
  for (const p of pts) {
    const dt = p.t - t0;
    const g = dt <= 0 ? 0 : dt + tau * Math.exp(-dt / tau) - tau;
    gs.push(g);
    const w = p.w ?? 1;
    num += w * p.x * g;
    den += w * g * g;
  }
  const vmax = den > 1e-12 ? num / den : 0;
  let sse = 0;
  pts.forEach((p, i) => {
    const r = p.x - vmax * gs[i];
    sse += (p.w ?? 1) * r * r;
  });
  return { vmax, sse };
};

/**
 * 指数モデルの3パラメータ（Vmax, τ, t0）フィット。
 * τ×t0 のグリッド探索＋2段階の局所細分（外部依存なし・決定的）。
 */
export const fitSprintExpo = (
  rawPoints: ExpoPoint[],
  opts?: { maxCourseX?: number }
): ExpoFit | null => {
  if (rawPoints.length < 3) return null;
  let pts = [...rawPoints].sort((a, b) => a.t - b.t);

  // 減速相の除外: 計測コース終端（最終スプリット距離）を超える点はモデル外
  const maxX = opts?.maxCourseX;
  let droppedDecel = 0;
  if (maxX != null) {
    const before = pts.length;
    pts = pts.filter(p => p.x <= maxX + 0.5);
    droppedDecel = before - pts.length;
  }
  if (pts.length < 3) return null;

  const tFirst = pts[0].t;

  let best = { tau: 1.0, t0: tFirst - 0.5, vmax: 8, sse: Infinity };
  let tauLo = 0.3, tauHi = 2.6, tauStep = 0.1;
  let t0Lo = tFirst - 2.0, t0Hi = tFirst + 0.25, t0Step = 0.1;

  for (let round = 0; round < 3; round++) {
    for (let tau = tauLo; tau <= tauHi + 1e-9; tau += tauStep) {
      for (let t0 = t0Lo; t0 <= t0Hi + 1e-9; t0 += t0Step) {
        // 最初の実測点より大きく後のt0は不合理（xが正の点の前に走り出している必要）
        const { vmax, sse } = solveVmax(pts, tau, t0);
        if (vmax <= 0 || vmax > 13.5) continue; // 人間の走速度として妥当な範囲
        if (sse < best.sse) best = { tau, t0, vmax, sse };
      }
    }
    // 細分化して局所探索
    tauLo = Math.max(0.2, best.tau - tauStep); tauHi = best.tau + tauStep; tauStep /= 5;
    t0Lo = best.t0 - t0Step; t0Hi = best.t0 + t0Step; t0Step /= 5;
  }
  if (!Number.isFinite(best.sse)) return null;

  // 決定係数・残差
  const wSum = pts.reduce((s, p) => s + (p.w ?? 1), 0);
  const xMean = pts.reduce((s, p) => s + (p.w ?? 1) * p.x, 0) / wSum;
  const ssTot = pts.reduce((s, p) => s + (p.w ?? 1) * (p.x - xMean) ** 2, 0);
  const posR2 = ssTot > 0 ? 1 - best.sse / ssTot : 0;
  const residuals = pts.map(p => {
    const dt = p.t - best.t0;
    const g = dt <= 0 ? 0 : dt + best.tau * Math.exp(-dt / best.tau) - best.tau;
    const pred = best.vmax * g;
    return { label: p.label ?? '', t: p.t, x: p.x, predicted: pred, residual: p.x - pred };
  });
  const rmse = Math.sqrt(best.sse / wSum);

  return {
    vmax: best.vmax, tau: best.tau, t0: best.t0,
    posR2, rmse, residuals,
    usedPoints: pts.length, droppedDecel,
  };
};

/** 単回帰（OLS） */
const linReg = (xs: number[], ys: number[]) => {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const r2 = sxx > 0 && syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, intercept, r2 };
};

/** 指数フィット結果から F-v プロファイル一式を計算 */
export const computeHFVPExpo = (
  points: ExpoPoint[],
  massKg: number,
  heightM: number,
  opts?: { maxCourseX?: number; hasStandingStart?: boolean }
): ExpoHFVP | null => {
  if (!(massKg > 0) || !(heightM > 0)) return null;
  const fit = fitSprintExpo(points, opts);
  if (!fit) return null;

  const kAero = 0.5 * RHO * CD * frontalArea(heightM, massKg);

  // モデルからサンプリングして F-v 回帰
  const tEnd = Math.max(...points.map(p => p.t)) - fit.t0; // 走り出しからの秒数
  const vs: number[] = [], fs: number[] = [], rfs: number[] = [], rfVs: number[] = [];
  for (let td = 0.05; td <= tEnd + 1e-9; td += 0.05) {
    const v = fit.vmax * (1 - Math.exp(-td / fit.tau));
    const a = (fit.vmax / fit.tau) * Math.exp(-td / fit.tau);
    const fH = massKg * a + kAero * v * v;
    vs.push(v); fs.push(fH / massKg); // 相対値で回帰
    if (td >= 0.3) { // RFはスタート直後の特異値を除外（Samozino準拠）
      const rf = (fH / Math.sqrt(fH * fH + (massKg * G) ** 2)) * 100;
      rfs.push(rf); rfVs.push(v);
    }
  }
  if (vs.length < 5) return null;

  const fv = linReg(vs, fs);           // f = f0Rel + slope·v（slope<0）
  const f0RelNkg = fv.intercept;
  const slopeFV = fv.slope;
  const v0 = slopeFV < 0 ? -f0RelNkg / slopeFV : NaN;
  const pmaxRelWkg = (f0RelNkg * v0) / 4;
  const rfFit = linReg(rfVs, rfs);

  const vmaxMeasured = fit.vmax * (1 - Math.exp(-tEnd / fit.tau));

  const warnings: string[] = [];
  if (!opts?.hasStandingStart) {
    warnings.push('0m（スタート）地点の登録が無いため、走り出しをモデル外挿で推定しています。0m登録で精度が向上します。');
  }
  if (fit.usedPoints < 4) warnings.push('データ点が少なめです（4点以上推奨）。');
  if (fit.droppedDecel > 0) warnings.push(`計測コース外の${fit.droppedDecel}点（減速相）をフィットから除外しました。`);
  if (fit.posR2 < 0.98) warnings.push('位置フィットの当てはまりが低め。スプリット/接地位置のばらつきを確認してください。');

  const physOk = f0RelNkg > 0 && Number.isFinite(v0) && v0 > vmaxMeasured * 0.98 && pmaxRelWkg > 0;
  if (!physOk) warnings.push('推定値が物理的に不自然です（参考値）。');
  const grade: ExpoHFVP['grade'] =
    physOk && fit.posR2 >= 0.995 && fit.usedPoints >= 4 ? '良'
    : physOk && fit.posR2 >= 0.98 ? '可' : '参考';

  return {
    method: 'expo', fit,
    f0N: f0RelNkg * massKg,
    f0RelNkg, v0, slopeFV,
    pmaxW: pmaxRelWkg * massKg, pmaxRelWkg,
    vmaxMeasured,
    rfMax: rfs.length ? Math.max(...rfs) : NaN,
    drf: rfFit.slope,
    fvR2: fv.r2,
    warnings, grade, kAero, massKg,
  };
};

/** ---------- 目標比較（努力目標）シミュレーション ---------- */

export interface GoalScenario {
  label: string;
  f0RelNkg: number;
  v0: number;
  deltaF0Pct: number;
  deltaV0Pct: number;
  simulatedTime: number;
}

export interface GoalComparison {
  targetDistance: number;
  currentTime: number;        // 現プロファイルでのシミュレーションタイム
  targetTime: number;
  gap: number;                // currentTime - targetTime（正=足りない）
  achieved: boolean;
  scenarios: GoalScenario[];  // F0のみ / V0のみ / 両方均等
  sensitivity: { f0Gain1pct: number; v0Gain1pct: number }; // 各+1%あたりの短縮秒
  recommendation: 'F0' | 'V0' | 'balanced';
}

/** F-Vプロファイル（相対F0, V0）から距離distのスプリントタイムを数値積分で求める */
export const simulateSprintTime = (
  f0RelNkg: number, v0: number, massKg: number, kAero: number, dist: number
): number => {
  if (!(f0RelNkg > 0) || !(v0 > 0) || !(dist > 0)) return NaN;
  const dt = 0.005;
  let v = 0, x = 0, t = 0;
  const kRel = kAero / massKg;
  for (let i = 0; i < 60000; i++) { // 最大300秒
    const fRel = Math.max(0, f0RelNkg * (1 - v / v0));
    const a = fRel - kRel * v * v;
    v = Math.max(0, v + a * dt);
    x += v * dt;
    t += dt;
    if (x >= dist) {
      // 最終ステップを線形補間
      const over = x - dist;
      return t - (v > 0 ? over / v : 0);
    }
  }
  return NaN;
};

/**
 * 目標タイム達成に必要なプロファイルを逆算。
 * シナリオ: F0のみ強化 / V0のみ強化 / 両方を同率強化
 */
export const compareWithGoal = (
  profile: Pick<ExpoHFVP, 'f0RelNkg' | 'v0' | 'massKg' | 'kAero'>,
  targetDistance: number,
  targetTime: number
): GoalComparison | null => {
  const { f0RelNkg, v0, massKg, kAero } = profile;
  const currentTime = simulateSprintTime(f0RelNkg, v0, massKg, kAero, targetDistance);
  if (!Number.isFinite(currentTime)) return null;

  const solveScale = (applyF0: boolean, applyV0: boolean): number | null => {
    // 二分法: scale ∈ [1, 1.6] で simulated <= targetTime となる最小倍率
    const sim = (s: number) => simulateSprintTime(
      f0RelNkg * (applyF0 ? s : 1), v0 * (applyV0 ? s : 1), massKg, kAero, targetDistance
    );
    if (sim(1.6) > targetTime) return null; // +60%でも届かない
    let lo = 1.0, hi = 1.6;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (sim(mid) <= targetTime) hi = mid; else lo = mid;
    }
    return hi;
  };

  const mk = (label: string, sF0: number | null, applyF0: boolean, applyV0: boolean): GoalScenario | null => {
    if (sF0 == null) return null;
    const nf = f0RelNkg * (applyF0 ? sF0 : 1);
    const nv = v0 * (applyV0 ? sF0 : 1);
    return {
      label,
      f0RelNkg: nf, v0: nv,
      deltaF0Pct: applyF0 ? (sF0 - 1) * 100 : 0,
      deltaV0Pct: applyV0 ? (sF0 - 1) * 100 : 0,
      simulatedTime: simulateSprintTime(nf, nv, massKg, kAero, targetDistance),
    };
  };

  const scenarios = [
    mk('F0（加速力）のみ強化', solveScale(true, false), true, false),
    mk('V0（最高速度）のみ強化', solveScale(false, true), false, true),
    mk('F0とV0を均等に強化', solveScale(true, true), true, true),
  ].filter((s): s is GoalScenario => s != null);

  // 感度: +1%あたりの短縮量
  const f0Gain1pct = currentTime - simulateSprintTime(f0RelNkg * 1.01, v0, massKg, kAero, targetDistance);
  const v0Gain1pct = currentTime - simulateSprintTime(f0RelNkg, v0 * 1.01, massKg, kAero, targetDistance);
  const recommendation: GoalComparison['recommendation'] =
    f0Gain1pct > v0Gain1pct * 1.3 ? 'F0'
    : v0Gain1pct > f0Gain1pct * 1.3 ? 'V0' : 'balanced';

  return {
    targetDistance,
    currentTime,
    targetTime,
    gap: currentTime - targetTime,
    achieved: currentTime <= targetTime,
    scenarios,
    sensitivity: { f0Gain1pct, v0Gain1pct },
    recommendation,
  };
};
