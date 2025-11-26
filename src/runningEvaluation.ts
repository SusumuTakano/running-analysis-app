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
  stepSummary: StepSummary,
  analysisType: 'acceleration' | 'topSpeed' = 'topSpeed'
): RunningEvaluation | null {
  if (!stepMetrics.length || !phaseAngles.length) return null;

  const evaluations: EvaluationItem[] = [];

  // 1. 姿勢評価（体幹角度）- シチュエーション別評価基準
  const avgTrunkAngle = phaseAngles.reduce((sum, p) => {
    return sum + (p.angles.trunkAngle ?? 90);
  }, 0) / phaseAngles.length;

  if (analysisType === 'acceleration') {
    // スタート加速時の基準（強い前傾が必要：42-48°前後）
    if (avgTrunkAngle >= 42 && avgTrunkAngle <= 48) {
      evaluations.push({
        category: '姿勢',
        score: 'excellent',
        icon: '✅',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 理想的な加速姿勢',
        advice: '理想的な45°前傾です。この姿勢により重心が前方に位置し、身体が自然に前方へ倒れ込むことで水平方向への強力な推進力が生まれています。最初の2-3歩で膝角度を固定したまま股関節伸展主導で加速できています。'
      });
    } else if (avgTrunkAngle >= 38 && avgTrunkAngle < 42) {
      evaluations.push({
        category: '姿勢',
        score: 'good',
        icon: '✅',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 良好な加速姿勢',
        advice: '良好な前傾姿勢です。42-45°の範囲を目指すと、重心移動と地面反力がさらに最適化されます。ブロッククリアランス後、体幹を一直線に保ったまま前方へ倒れ込む意識を持ちましょう。'
      });
    } else if (avgTrunkAngle > 48 && avgTrunkAngle <= 60) {
      evaluations.push({
        category: '姿勢',
        score: 'good',
        icon: '⚠️',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - やや前傾不足',
        advice: 'やや前傾が浅いです。スタート直後の加速局面では42-45°の強い前傾が必要です。ブロックを押し切った後、体幹を一直線に保ち、重心を前方に位置させることで水平推進力を最大化できます。'
      });
    } else if (avgTrunkAngle > 60 && avgTrunkAngle <= 80) {
      evaluations.push({
        category: '姿勢',
        score: 'fair',
        icon: '⚠️',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 前傾不足（早期起き上がり）',
        advice: 'スタート直後に早期起き上がりが発生しています。最初の2-3歩は膝角度を固定したまま、股関節伸展（大臀筋・ハムストリングス主導）で地面を後方へ押し続けることが重要です。体幹を起こさず、頭部から足首まで一直線を保ち、身体全体で前方に倒れ込むイメージを持ちましょう。'
      });
    } else if (avgTrunkAngle > 80) {
      evaluations.push({
        category: '姿勢',
        score: 'poor',
        icon: '❌',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 完全な直立（加速失敗）',
        advice: '加速局面で完全に体幹が起きています。これではスタート動作が機能していません。ブロッククリアランス後、最初の2-3歩は膝関節を固定（150-160°程度）し、股関節の伸展動作のみでストライドを伸ばす意識が必要です。膝を引き上げて走るのではなく、足が身体の後方にある状態で股関節を伸ばし、地面を後ろに押し続けることで水平加速が生まれます。'
      });
    } else {
      // avgTrunkAngle < 38の場合
      evaluations.push({
        category: '姿勢',
        score: 'fair',
        icon: '⚠️',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - やや過度な前傾',
        advice: '前傾が強すぎる可能性があります。38-48°の範囲で、バランスを保ちながら股関節伸展による推進力を最大化しましょう。'
      });
    }
  } else {
    // トップスピード時の基準（垂直姿勢重視 80-90°）
    if (avgTrunkAngle >= 80 && avgTrunkAngle <= 90) {
      evaluations.push({
        category: '姿勢',
        score: 'excellent',
        icon: '✅',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 理想的（トップスピード）',
        advice: '素晴らしい姿勢です。トップスピード維持に最適な体幹角度を保てています。真下への踏み込みで地面反力を最大化できています。'
      });
    } else if (avgTrunkAngle >= 78 && avgTrunkAngle < 80) {
      evaluations.push({
        category: '姿勢',
        score: 'good',
        icon: '✅',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 良好（トップスピード）',
        advice: '良好な姿勢です。80°以上を目指すとさらに効率が向上します。'
      });
    } else if (avgTrunkAngle > 90 && avgTrunkAngle <= 92) {
      evaluations.push({
        category: '姿勢',
        score: 'good',
        icon: '✅',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - ほぼ垂直（トップスピード）',
        advice: 'ほぼ垂直姿勢です。軽く前傾（85-90°）を意識するとさらに効率的になります。'
      });
    } else if (avgTrunkAngle < 78) {
      evaluations.push({
        category: '姿勢',
        score: 'fair',
        icon: '⚠️',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - やや前傾しすぎ（トップスピード）',
        advice: 'トップスピード時は前傾を抑え、80-90°の範囲を目指しましょう。真下への踏み込みを意識してください。'
      });
    } else {
      evaluations.push({
        category: '姿勢',
        score: 'fair',
        icon: '⚠️',
        message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - やや後傾（トップスピード）',
        advice: '後傾しています。みぞおちを前に出し、体幹の軸を作ることを意識しましょう。80-90°の範囲を目指してください。'
      });
    }
  }

  // 2. ピッチとストライドのバランス - シチュエーション別評価
  const avgPitch = stepSummary.avgStepPitch ?? 0;
  const avgStride = stepSummary.avgStride ?? 0;
  
  if (avgPitch > 0 && avgStride > 0) {
    const pitchPerMin = avgPitch * 60;
    
    if (analysisType === 'acceleration') {
      // 加速局面：ストライド伸長が最重要
      if (avgStride >= 1.4) {
        evaluations.push({
          category: 'ストライド伸長',
          score: 'excellent',
          icon: '✅',
          message: 'ストライド: ' + avgStride.toFixed(2) + 'm - 優秀な伸長',
          advice: '優れたストライド伸長です。スタート直後から一歩ごとに段階的にストライドを伸ばせています。膝関節を固定したまま股関節伸展で地面を後方へ押す動作が実現できています。この技術により接地時間を最小限に抑えながら大きな推進力を得られています。'
        });
      } else if (avgStride >= 1.2) {
        evaluations.push({
          category: 'ストライド伸長',
          score: 'good',
          icon: '✅',
          message: 'ストライド: ' + avgStride.toFixed(2) + 'm - 良好',
          advice: '良好なストライド伸長です。さらに伸ばすためには、最初の2-3歩で膝関節角度を150-160°程度に固定し、股関節伸展動作のみでストライドを獲得することを意識してください。膝を曲げて引き上げる動作は水平加速を妨げます。'
        });
      } else {
        evaluations.push({
          category: 'ストライド伸長',
          score: 'fair',
          icon: '⚠️',
          message: 'ストライド: ' + avgStride.toFixed(2) + 'm - 伸長不足',
          advice: 'ストライド伸長が不十分です。スタート時のストライド伸長不足は、膝関節の早期屈曲（膝を引き上げる動作）が原因である可能性が高いです。最初の2-3歩は膝を伸ばしたまま保ち、股関節伸展のみでストライドを獲得してください。接地は身体の後方で行い、地面を後ろに押す意識を持ちましょう。'
        });
      }
    } else {
      // トップスピード：ピッチとストライドのバランス
      if (pitchPerMin >= 185 && pitchPerMin <= 195) {
        evaluations.push({
          category: 'ピッチ・ストライド',
          score: 'excellent',
          icon: '✅',
          message: 'ピッチ: ' + pitchPerMin.toFixed(0) + '歩/分 - 優秀',
          advice: '理想的なピッチです。このリズムを維持しながら、ストライドを伸ばすことでさらにスピードアップできます。'
        });
      } else if (pitchPerMin >= 180 && pitchPerMin < 185) {
        evaluations.push({
          category: 'ピッチ・ストライド',
          score: 'good',
          icon: '✅',
          message: 'ピッチ: ' + pitchPerMin.toFixed(0) + '歩/分 - 良好',
          advice: '良いピッチですが、185歩/分以上を目指すとさらに効率的になります。'
        });
      } else if (pitchPerMin < 180) {
        const strideAdvice = avgStride > 1.4 ? 'ストライドは十分ですが、' : 'ストライドも短めです。';
        evaluations.push({
          category: 'ピッチ・ストライド',
          score: 'fair',
          icon: '⚠️',
          message: 'ピッチ: ' + pitchPerMin.toFixed(0) + '歩/分 - 改善が必要',
          advice: strideAdvice + 'ピッチを180歩/分以上に上げると、接地時間が短くなり効率が大幅に向上します。'
        });
      } else {
        evaluations.push({
          category: 'ピッチ・ストライド',
          score: 'fair',
          icon: '⚠️',
          message: 'ピッチ: ' + pitchPerMin.toFixed(0) + '歩/分 - 高すぎる',
          advice: 'ピッチが高すぎます。ストライドを意識的に伸ばし、195歩/分以下を目指しましょう。'
        });
      }
    }
  }

  // 3. 接地時間評価 - より厳しい基準
  const avgContact = stepSummary.avgContact ?? 0;
  
  if (avgContact > 0) {
    if (avgContact <= 0.18) {
      evaluations.push({
        category: '接地時間',
        score: 'excellent',
        icon: '✅',
        message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - エリートレベル',
        advice: 'トップランナー並みの非常に短い接地時間です。理想的な軽快な走りができています。'
      });
    } else if (avgContact <= 0.22) {
      evaluations.push({
        category: '接地時間',
        score: 'good',
        icon: '✅',
        message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 良好',
        advice: '良好な接地時間です。180ms以下を目指すとエリートレベルに到達できます。'
      });
    } else if (avgContact <= 0.26) {
      evaluations.push({
        category: '接地時間',
        score: 'fair',
        icon: '⚠️',
        message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 改善の余地あり',
        advice: '接地時間をさらに短縮する必要があります。前足部着地とピッチアップを意識しましょう。'
      });
    } else {
      evaluations.push({
        category: '接地時間',
        score: 'poor',
        icon: '❌',
        message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 長すぎる',
        advice: '接地時間が長すぎます。地面を蹴る意識を捨て、足を素早く引き上げることに集中しましょう。260ms以下を目指してください。'
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
    
    if (thighRangeOfMotion >= 70) {
      evaluations.push({
        category: '股関節の可動域',
        score: 'excellent',
        icon: '✅',
        message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 優秀',
        advice: '股関節の可動域が非常に広く、ダイナミックな走りができています。後方へのキックも十分に効いています。'
      });
    } else if (thighRangeOfMotion >= 60) {
      evaluations.push({
        category: '股関節の可動域',
        score: 'good',
        icon: '✅',
        message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 良好',
        advice: '股関節の使い方は良好です。70°以上を目指すとさらにダイナミックになります。'
      });
    } else if (thighRangeOfMotion >= 50) {
      evaluations.push({
        category: '股関節の可動域',
        score: 'fair',
        icon: '⚠️',
        message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 改善が必要',
        advice: '股関節の可動域が不足しています。後方へのキックと前方への引き上げを意識して、60°以上を目指しましょう。'
      });
    } else {
      evaluations.push({
        category: '股関節の可動域',
        score: 'poor',
        icon: '❌',
        message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 小さすぎる',
        advice: '股関節の可動域が非常に小さいです。ストレッチと股関節を使った走り込みで、可動域を広げる必要があります。'
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
