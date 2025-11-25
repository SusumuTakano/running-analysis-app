/** AI評価データ */
export type EvaluationItem = {
  category: string;
  score: 'excellent' | 'good' | 'fair' | 'poor';
  icon: string;
  message: string;
  advice: string;
};

export type RunningEvaluation = {
  evaluations: EvaluationItem[];
  overallRating: string;
  overallMessage: string;
  avgScore: number;
};

type PhaseAngles = {
  phase: "initial" | "mid" | "late";
  frame: number;
  angles: {
    trunkAngle: number | null;
    hipAnkleAngle: { left: number | null; right: number | null };
    thighAngle: { left: number | null; right: number | null };
    shankAngle: { left: number | null; right: number | null };
    kneeFlex: { left: number | null; right: number | null };
    ankleFlex: { left: number | null; right: number | null };
    elbowAngle: { left: number | null; right: number | null };
    toeHorizontalDistance: { left: number | null; right: number | null };
  };
};

type StepSummary = {
  avgContact: number;
  avgFlight: number;
  avgStepPitch: number;
  avgStride: number;
  avgSpeed: number;
};

export function generateRunningEvaluation(
  stepMetrics: any[],
  phaseAngles: PhaseAngles[],
  stepSummary: StepSummary
): RunningEvaluation | null {
  if (!stepMetrics.length || !phaseAngles.length) return null;

  const evaluations: EvaluationItem[] = [];

  // 1. 姿勢評価（体幹角度）
  const avgTrunkAngle = phaseAngles.reduce((sum, p) => {
    return sum + (p.angles.trunkAngle ?? 90);
  }, 0) / phaseAngles.length;

  if (avgTrunkAngle >= 88 && avgTrunkAngle <= 92) {
    evaluations.push({
      category: '姿勢',
      score: 'good',
      icon: '⚠️',
      message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - ほぼ垂直',
      advice: '軽い前傾姿勢（85-88°）を意識すると、重心移動がスムーズになり推進力が向上します。'
    });
  } else if (avgTrunkAngle >= 85 && avgTrunkAngle < 88) {
    evaluations.push({
      category: '姿勢',
      score: 'excellent',
      icon: '✅',
      message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 理想的な前傾',
      advice: '素晴らしい前傾姿勢です。股関節の伸展筋群を効率的に使えています。'
    });
  } else if (avgTrunkAngle < 85) {
    evaluations.push({
      category: '姿勢',
      score: 'poor',
      icon: '❌',
      message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 過度な前傾',
      advice: '前傾しすぎです。腰への負担が大きく、膝への衝撃も増加します。上体を起こしましょう。'
    });
  } else {
    evaluations.push({
      category: '姿勢',
      score: 'fair',
      icon: '⚠️',
      message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - やや後傾',
      advice: '後傾気味です。みぞおちを意識的に前に出すことで、前傾姿勢を作りましょう。'
    });
  }

  // 2. ピッチとストライドのバランス
  const avgPitch = stepSummary.avgStepPitch ?? 0;
  const avgStride = stepSummary.avgStride ?? 0;
  
  if (avgPitch > 0 && avgStride > 0) {
    const pitchPerMin = avgPitch * 60;
    
    if (pitchPerMin >= 180 && pitchPerMin <= 190) {
      evaluations.push({
        category: 'ピッチ・ストライド',
        score: 'excellent',
        icon: '✅',
        message: 'ピッチ: ' + pitchPerMin.toFixed(0) + '歩/分 - 理想的',
        advice: '理想的なピッチです。このリズムを維持しながら、ストライドを伸ばすことでスピードアップできます。'
      });
    } else if (pitchPerMin < 180) {
      const strideAdvice = avgStride > 1.3 ? 'ストライドは十分です。' : 'ストライドも短めです。';
      evaluations.push({
        category: 'ピッチ・ストライド',
        score: 'fair',
        icon: '⚠️',
        message: 'ピッチ: ' + pitchPerMin.toFixed(0) + '歩/分 - やや低い',
        advice: strideAdvice + 'ピッチを180歩/分以上に上げると、接地時間が短くなり効率が向上します。'
      });
    } else {
      evaluations.push({
        category: 'ピッチ・ストライド',
        score: 'good',
        icon: '✅',
        message: 'ピッチ: ' + pitchPerMin.toFixed(0) + '歩/分 - 高め',
        advice: 'ピッチは高いです。余裕があればストライドを伸ばすことでスピードアップできます。'
      });
    }
  }

  // 3. 接地時間評価
  const avgContact = stepSummary.avgContact ?? 0;
  
  if (avgContact > 0) {
    if (avgContact <= 0.20) {
      evaluations.push({
        category: '接地時間',
        score: 'excellent',
        icon: '✅',
        message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - エリートレベル',
        advice: 'トップランナー並みの短い接地時間です。軽快な走りができています。'
      });
    } else if (avgContact <= 0.25) {
      evaluations.push({
        category: '接地時間',
        score: 'good',
        icon: '✅',
        message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 良好',
        advice: '良好な接地時間です。さらに短縮するには、前足部着地を意識しましょう。'
      });
    } else if (avgContact <= 0.30) {
      evaluations.push({
        category: '接地時間',
        score: 'fair',
        icon: '⚠️',
        message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 標準的',
        advice: '市民ランナーの標準的な値です。ピッチを上げることで短縮できます。'
      });
    } else {
      evaluations.push({
        category: '接地時間',
        score: 'poor',
        icon: '❌',
        message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - やや長い',
        advice: '接地時間が長いです。地面を蹴るのではなく、足を素早く引き上げる意識を持ちましょう。'
      });
    }
  }

  // 4. 接地時間と滞空時間のバランス
  const avgFlight = stepSummary.avgFlight ?? 0;
  
  if (avgContact > 0 && avgFlight > 0) {
    const contactFlightRatio = avgContact / avgFlight;
    
    if (contactFlightRatio >= 0.8 && contactFlightRatio <= 1.2) {
      evaluations.push({
        category: '接地・滞空バランス',
        score: 'excellent',
        icon: '✅',
        message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - バランス良好',
        advice: '接地時間と滞空時間のバランスが理想的です。効率的な走りができています。'
      });
    } else if (contactFlightRatio > 1.2) {
      evaluations.push({
        category: '接地・滞空バランス',
        score: 'fair',
        icon: '⚠️',
        message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - 接地時間が長め',
        advice: '接地時間が滞空時間に比べて長いです。より軽快な走りを目指しましょう。'
      });
    } else {
      evaluations.push({
        category: '接地・滞空バランス',
        score: 'good',
        icon: '✅',
        message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - 滞空時間が長め',
        advice: 'ストライド走法の傾向があります。安定性を保ちながら接地を意識しましょう。'
      });
    }
  }

  // 5. 大腿角度（股関節の使い方）
  const thighAngles = phaseAngles.flatMap(p => [
    p.angles.thighAngle.left,
    p.angles.thighAngle.right
  ]).filter(a => a !== null) as number[];
  
  if (thighAngles.length > 0) {
    const maxThighAngle = Math.max(...thighAngles);
    const minThighAngle = Math.min(...thighAngles);
    const thighRangeOfMotion = maxThighAngle - minThighAngle;
    
    if (thighRangeOfMotion >= 60) {
      evaluations.push({
        category: '股関節の可動域',
        score: 'excellent',
        icon: '✅',
        message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 優秀',
        advice: '股関節の可動域が広く、ダイナミックな走りができています。後方へのキックも効いています。'
      });
    } else if (thighRangeOfMotion >= 50) {
      evaluations.push({
        category: '股関節の可動域',
        score: 'good',
        icon: '✅',
        message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 良好',
        advice: '股関節の使い方は良好です。さらにダイナミックに動かすことでストライドが伸びます。'
      });
    } else {
      evaluations.push({
        category: '股関節の可動域',
        score: 'fair',
        icon: '⚠️',
        message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - やや小さい',
        advice: '股関節の可動域が小さめです。後方へのキック（蹴り出し）を意識して、可動域を広げましょう。'
      });
    }
  }

  // 総合評価
  const scorePoints = {
    excellent: 4,
    good: 3,
    fair: 2,
    poor: 1
  };
  
  const avgScore = evaluations.reduce((sum, e) => sum + scorePoints[e.score], 0) / evaluations.length;
  
  let overallRating = '';
  let overallMessage = '';
  
  if (avgScore >= 3.5) {
    overallRating = 'エリートレベル';
    overallMessage = '素晴らしいランニングフォームです。非常に効率的で、パフォーマンスが高いです。';
  } else if (avgScore >= 3.0) {
    overallRating = '上級レベル';
    overallMessage = '良好なランニングフォームです。細かな改善でさらにレベルアップできます。';
  } else if (avgScore >= 2.5) {
    overallRating = '中級レベル';
    overallMessage = '標準的なランニングフォームです。改善の余地があります。';
  } else {
    overallRating = '初級レベル';
    overallMessage = 'フォームの改善が必要です。アドバイスを参考に練習しましょう。';
  }

  return {
    evaluations,
    overallRating,
    overallMessage,
    avgScore
  };
}
