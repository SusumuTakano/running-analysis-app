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

type AthleteInfo = {
  heightCm?: number | null;
  gender?: 'male' | 'female' | 'other' | null;
};

export function generateRunningEvaluation(
  stepMetrics: any[],
  phaseAngles: PhaseAngles[],
  stepSummary: StepSummary,
  analysisType: 'acceleration' | 'topSpeed' = 'topSpeed',
  athleteInfo?: AthleteInfo
): RunningEvaluation | null {
  if (!stepMetrics.length || !phaseAngles.length) return null;

  const evaluations: EvaluationItem[] = [];
  const heightCm = athleteInfo?.heightCm;
  const gender = athleteInfo?.gender;

  // 1. 姿勢評価（体幹角度）- シチュエーション別評価基準
  const avgTrunkAngle = phaseAngles.reduce((sum, p) => {
    return sum + (p.angles.trunkAngle ?? 90);
  }, 0) / phaseAngles.length;

  if (analysisType === 'acceleration') {
    // ===== スタートダッシュモード専用評価 =====
    
    // 🎯 各ステップの体幹角度を取得（加速局面の段階的評価用）
    const stepTrunkAngles: (number | null)[] = stepMetrics.map(s => s.trunkAngleAtContact ?? null);
    const validStepAngles = stepTrunkAngles.filter((a): a is number => a !== null);
    
    // 🎯 各ステップの膝角度を取得
    const stepKneeAngles: (number | null)[] = stepMetrics.map(s => s.kneeFlexAtContact ?? null);
    const validKneeAngles = stepKneeAngles.filter((a): a is number => a !== null);
    
    // 理想的なステップごとの体幹角度（1歩目:45°→8歩目:75°で段階的に起こす）
    // 各ステップの理想角度: step1=45°, step2=49°, step3=52°, step4=56°, step5=60°, step6=64°, step7=68°, step8=72°
    const idealTrunkProgression = [45, 49, 52, 56, 60, 64, 68, 72, 75, 78, 80, 82];
    
    // === 1. 姿勢の段階的起き上がり評価 ===
    if (validStepAngles.length >= 3) {
      // ステップごとの角度変化を分析
      const firstStepAngle = validStepAngles[0];
      const lastStepAngle = validStepAngles[validStepAngles.length - 1];
      const totalAngleChange = lastStepAngle - firstStepAngle;
      
      // 1歩目の姿勢評価（45°前後が理想）
      let firstStepEval: 'excellent' | 'good' | 'fair' | 'poor';
      let firstStepMessage = '';
      let firstStepAdvice = '';
      
      if (firstStepAngle >= 40 && firstStepAngle <= 50) {
        firstStepEval = 'excellent';
        firstStepMessage = `1歩目の体幹角度: ${firstStepAngle.toFixed(1)}° - 理想的（目標:45°）`;
        firstStepAdvice = '1歩目の前傾角度が理想的です。重心を前方に位置させ、強い水平推進力を生み出せる姿勢です。';
      } else if (firstStepAngle >= 35 && firstStepAngle < 40) {
        firstStepEval = 'good';
        firstStepMessage = `1歩目の体幹角度: ${firstStepAngle.toFixed(1)}° - やや前傾が強い（目標:45°）`;
        firstStepAdvice = '1歩目の前傾がやや強いです。バランスを崩さないよう注意しながら、40-50°の範囲を目指しましょう。';
      } else if (firstStepAngle > 50 && firstStepAngle <= 60) {
        firstStepEval = 'good';
        firstStepMessage = `1歩目の体幹角度: ${firstStepAngle.toFixed(1)}° - やや前傾が浅い（目標:45°）`;
        firstStepAdvice = '1歩目の前傾がやや浅いです。ブロッククリアランス直後は45°前後の強い前傾を維持し、水平推進力を最大化しましょう。';
      } else if (firstStepAngle > 60) {
        firstStepEval = 'fair';
        firstStepMessage = `1歩目の体幹角度: ${firstStepAngle.toFixed(1)}° - 前傾不足（目標:45°）`;
        firstStepAdvice = '1歩目から体幹が起きすぎています。スタート直後は頭部から足首まで一直線に保ち、身体全体で前方へ倒れ込むイメージを持ちましょう。';
      } else {
        firstStepEval = 'fair';
        firstStepMessage = `1歩目の体幹角度: ${firstStepAngle.toFixed(1)}° - 過度な前傾（目標:45°）`;
        firstStepAdvice = '1歩目の前傾が強すぎます。バランスを崩さないよう、40-50°の範囲を目指しましょう。';
      }
      
      evaluations.push({
        category: '1歩目の姿勢',
        score: firstStepEval,
        icon: firstStepEval === 'excellent' ? '✅' : firstStepEval === 'good' ? '✅' : '⚠️',
        message: firstStepMessage,
        advice: firstStepAdvice
      });
      
      // 段階的な起き上がりの評価
      // 理想: 1歩ごとに約3-5°ずつ起こしていく（8歩で約30°の変化）
      const expectedAngleChange = Math.min(validStepAngles.length - 1, 8) * 4; // 1歩あたり4°の変化を期待
      
      let progressionEval: 'excellent' | 'good' | 'fair' | 'poor';
      let progressionMessage = '';
      let progressionAdvice = '';
      
      // 角度変化の適切さを評価
      if (totalAngleChange >= expectedAngleChange * 0.7 && totalAngleChange <= expectedAngleChange * 1.5) {
        // 適切な段階的起き上がり
        const avgChangePerStep = totalAngleChange / (validStepAngles.length - 1);
        if (avgChangePerStep >= 2 && avgChangePerStep <= 6) {
          progressionEval = 'excellent';
          progressionMessage = `姿勢の段階的変化: ${firstStepAngle.toFixed(0)}°→${lastStepAngle.toFixed(0)}°（${validStepAngles.length}歩で+${totalAngleChange.toFixed(0)}°）- 理想的`;
          progressionAdvice = '素晴らしい！1歩ごとに段階的に体幹を起こせています。加速局面の理想的なパターンです。';
        } else {
          progressionEval = 'good';
          progressionMessage = `姿勢の段階的変化: ${firstStepAngle.toFixed(0)}°→${lastStepAngle.toFixed(0)}°（${validStepAngles.length}歩で+${totalAngleChange.toFixed(0)}°）- 良好`;
          progressionAdvice = '概ね良好な段階的起き上がりです。1歩あたり3-5°の変化を目指すと、より効率的な加速が可能です。';
        }
      } else if (totalAngleChange < expectedAngleChange * 0.3) {
        // 起き上がりが不十分（前傾を維持しすぎ）
        progressionEval = 'fair';
        progressionMessage = `姿勢の段階的変化: ${firstStepAngle.toFixed(0)}°→${lastStepAngle.toFixed(0)}°（${validStepAngles.length}歩で+${totalAngleChange.toFixed(0)}°）- 起き上がり不足`;
        progressionAdvice = '前傾姿勢を維持しすぎています。8歩目までに75°程度まで段階的に起こすことで、トップスピードへの移行がスムーズになります。';
      } else if (totalAngleChange > expectedAngleChange * 2) {
        // 急激な起き上がり
        progressionEval = 'fair';
        progressionMessage = `姿勢の段階的変化: ${firstStepAngle.toFixed(0)}°→${lastStepAngle.toFixed(0)}°（${validStepAngles.length}歩で+${totalAngleChange.toFixed(0)}°）- 急激な起き上がり`;
        progressionAdvice = '体幹の起き上がりが急すぎます。加速力が十分に発揮される前に起き上がると、水平推進力が低下します。8歩程度かけて段階的に起こしましょう。';
      } else if (totalAngleChange < 0) {
        // 逆に前傾が強くなっている（まれ）
        progressionEval = 'poor';
        progressionMessage = `姿勢の段階的変化: ${firstStepAngle.toFixed(0)}°→${lastStepAngle.toFixed(0)}°（${validStepAngles.length}歩で${totalAngleChange.toFixed(0)}°）- 不適切なパターン`;
        progressionAdvice = '加速中に前傾が強くなっています。これは自然な動作パターンではありません。1歩目から段階的に体幹を起こしていく意識を持ちましょう。';
      } else {
        progressionEval = 'good';
        progressionMessage = `姿勢の段階的変化: ${firstStepAngle.toFixed(0)}°→${lastStepAngle.toFixed(0)}°（${validStepAngles.length}歩で+${totalAngleChange.toFixed(0)}°）- 概ね適切`;
        progressionAdvice = '段階的な起き上がりは概ね適切です。より滑らかな変化を目指しましょう。';
      }
      
      evaluations.push({
        category: '姿勢の段階的変化',
        score: progressionEval,
        icon: progressionEval === 'excellent' ? '✅' : progressionEval === 'good' ? '✅' : progressionEval === 'fair' ? '⚠️' : '❌',
        message: progressionMessage,
        advice: progressionAdvice
      });
      
    } else {
      // ステップ数が少ない場合は平均角度で評価（既存ロジック）
      if (avgTrunkAngle >= 42 && avgTrunkAngle <= 55) {
        evaluations.push({
          category: '姿勢',
          score: 'excellent',
          icon: '✅',
          message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 適切な加速姿勢',
          advice: '加速局面に適した前傾姿勢です。'
        });
      } else if (avgTrunkAngle > 55 && avgTrunkAngle <= 70) {
        evaluations.push({
          category: '姿勢',
          score: 'good',
          icon: '✅',
          message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 良好',
          advice: '良好な姿勢ですが、スタート直後はより強い前傾（45°前後）を目指しましょう。'
        });
      } else if (avgTrunkAngle > 70) {
        evaluations.push({
          category: '姿勢',
          score: 'fair',
          icon: '⚠️',
          message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 前傾不足',
          advice: 'スタート直後の前傾が不足しています。45°前後から始め、8歩程度で徐々に起こしていきましょう。'
        });
      } else {
        evaluations.push({
          category: '姿勢',
          score: 'fair',
          icon: '⚠️',
          message: '体幹角度: ' + avgTrunkAngle.toFixed(1) + '° - 過度な前傾',
          advice: '前傾が強すぎます。バランスを崩さないよう、40-50°の範囲を目指しましょう。'
        });
      }
    }
    
    // === 2. 膝関節の固定・引きつけ評価（加速局面専用） ===
    if (validKneeAngles.length >= 2) {
      const firstStepKnee = validKneeAngles[0];
      const secondStepKnee = validKneeAngles.length > 1 ? validKneeAngles[1] : null;
      const thirdStepKnee = validKneeAngles.length > 2 ? validKneeAngles[2] : null;
      
      // 最初の2-3歩の膝角度の変化を分析
      // 理想: 1歩目は150-160°（膝を固定）、徐々に屈曲を増やしていく
      let kneeEval: 'excellent' | 'good' | 'fair' | 'poor';
      let kneeMessage = '';
      let kneeAdvice = '';
      
      if (firstStepKnee >= 145 && firstStepKnee <= 170) {
        // 1歩目の膝角度が理想的（固定されている）
        kneeEval = 'excellent';
        kneeMessage = `1歩目の膝角度: ${firstStepKnee.toFixed(0)}° - 理想的な固定（目標:150-160°）`;
        kneeAdvice = '1歩目で膝関節を適切に固定できています。股関節伸展主導で地面を後方へ押し、効率的に水平推進力を得ています。';
        
        // 段階的な引きつけの評価
        if (secondStepKnee != null && thirdStepKnee != null) {
          const kneeFlexionProgress = firstStepKnee - thirdStepKnee; // 膝の屈曲増加量
          if (kneeFlexionProgress >= 5 && kneeFlexionProgress <= 25) {
            kneeAdvice += ' その後、段階的に膝の引きつけを増やせています。';
          } else if (kneeFlexionProgress < 5) {
            kneeAdvice += ' ただし、3歩目以降はより積極的に膝を引きつけていくと、ピッチが向上します。';
          }
        }
      } else if (firstStepKnee >= 130 && firstStepKnee < 145) {
        kneeEval = 'good';
        kneeMessage = `1歩目の膝角度: ${firstStepKnee.toFixed(0)}° - やや屈曲気味（目標:150-160°）`;
        kneeAdvice = '1歩目で膝がやや曲がっています。スタート直後の1-2歩は膝を150-160°程度に固定し、股関節伸展で推進力を得ましょう。';
      } else if (firstStepKnee > 170) {
        kneeEval = 'good';
        kneeMessage = `1歩目の膝角度: ${firstStepKnee.toFixed(0)}° - 膝が伸びすぎ（目標:150-160°）`;
        kneeAdvice = '1歩目の膝が伸びすぎています。完全伸展ではなく、わずかに曲げた状態（150-160°）で固定すると、力の伝達効率が向上します。';
      } else if (firstStepKnee < 130) {
        kneeEval = 'fair';
        kneeMessage = `1歩目の膝角度: ${firstStepKnee.toFixed(0)}° - 膝の屈曲が早い（目標:150-160°）`;
        kneeAdvice = 'スタート1歩目から膝が曲がりすぎています。最初の2-3歩は膝を固定したまま、股関節の伸展動作のみでストライドを獲得してください。膝を引き上げる動作は3歩目以降から徐々に行いましょう。';
      } else {
        kneeEval = 'fair';
        kneeMessage = `1歩目の膝角度: ${firstStepKnee.toFixed(0)}°`;
        kneeAdvice = '膝角度のデータを確認してください。';
      }
      
      evaluations.push({
        category: '膝関節の使い方',
        score: kneeEval,
        icon: kneeEval === 'excellent' ? '✅' : kneeEval === 'good' ? '✅' : '⚠️',
        message: kneeMessage,
        advice: kneeAdvice
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
      // 研究データに基づく評価基準:
      // 男子: ピッチ型4.66歩/秒(280歩/分)、平均型4.84歩/秒(290歩/分)、ストライド型5.03歩/秒(302歩/分)
      // 女子: ピッチ型4.44歩/秒(266歩/分)、平均型4.65歩/秒(279歩/分)、ストライド型4.86歩/秒(292歩/分)
      // 評価基準（歩/秒で評価）:
      // - 優秀: 4.5歩/秒以上 (270歩/分以上)
      // - 良好: 4.0〜4.5歩/秒 (240〜270歩/分)
      // - 適正: 3.5〜4.0歩/秒 (210〜240歩/分)
      // - 改善が必要: 3.5歩/秒未満 (210歩/分未満)
      
      if (avgPitch >= 4.5) {
        evaluations.push({
          category: 'ピッチ・ストライド',
          score: 'excellent',
          icon: '✅',
          message: 'ピッチ: ' + avgPitch.toFixed(2) + '歩/秒 (' + pitchPerMin.toFixed(0) + '歩/分) - エリートレベル',
          advice: '最大疾走スピード達成に必要なエリートレベルのピッチです。このリズムを維持しながら、ストライドとのバランスを調整していきましょう。'
        });
      } else if (avgPitch >= 4.0) {
        evaluations.push({
          category: 'ピッチ・ストライド',
          score: 'good',
          icon: '✅',
          message: 'ピッチ: ' + avgPitch.toFixed(2) + '歩/秒 (' + pitchPerMin.toFixed(0) + '歩/分) - 良好',
          advice: '良好なピッチです。4.5歩/秒（270歩/分）以上を目指すと、さらに高い速度が期待できます。'
        });
      } else if (avgPitch >= 3.5) {
        evaluations.push({
          category: 'ピッチ・ストライド',
          score: 'fair',
          icon: '⚠️',
          message: 'ピッチ: ' + avgPitch.toFixed(2) + '歩/秒 (' + pitchPerMin.toFixed(0) + '歩/分) - 向上の余地あり',
          advice: 'ピッチがやや低めです。研究データによると、最大疾走スピード達成には4.4〜5.0歩/秒程度が必要です。腕振りのリズムを速め、接地時間を短縮することでピッチを向上させましょう。'
        });
      } else {
        evaluations.push({
          category: 'ピッチ・ストライド',
          score: 'poor',
          icon: '❌',
          message: 'ピッチ: ' + avgPitch.toFixed(2) + '歩/秒 (' + pitchPerMin.toFixed(0) + '歩/分) - 改善が必要',
          advice: 'ピッチが低すぎます。最大疾走スピード達成には4.4歩/秒以上のピッチが必要です。接地時間の短縮、腕振りの強化、レッグスピードトレーニングを行いましょう。'
        });
      }
    }
  }

  // 2.5 ストライド/身長比率の評価（身長データがある場合のみ）
  // 研究データに基づく評価基準:
  // - エリートスプリンター: ストライド/身長比 = 1.20〜1.35
  // - 一般競技者（トップスピード時）: 1.10〜1.25
  // - 加速局面: 0.8〜1.1程度が適正
  // 男子: 身長180cmで最適ストライド2.15〜2.45m（比率1.19〜1.36）
  // 女子: 身長165cmで最適ストライド1.95〜2.20m（比率1.18〜1.33）
  if (heightCm && heightCm > 0 && avgStride > 0) {
    const heightM = heightCm / 100;
    const strideHeightRatio = avgStride / heightM;
    
    // 性別による基準値の調整
    const isMale = gender === 'male';
    const isFemale = gender === 'female';
    
    // 基準値（トップスピード時）
    const excellentMin = isFemale ? 1.18 : 1.20;
    const excellentMax = isFemale ? 1.33 : 1.35;
    const goodMin = isFemale ? 1.10 : 1.12;
    const goodMax = isFemale ? 1.40 : 1.42;
    
    if (analysisType === 'acceleration') {
      // 加速局面での評価（ストライド/身長比は低めが適正）
      if (strideHeightRatio >= 0.85 && strideHeightRatio <= 1.15) {
        evaluations.push({
          category: 'ストライド/身長比',
          score: 'excellent',
          icon: '✅',
          message: `ストライド/身長比: ${strideHeightRatio.toFixed(2)} (${avgStride.toFixed(2)}m / ${heightCm}cm) - 加速局面で適正`,
          advice: '加速局面に適したストライド/身長比です。身長に対して効率的なストライド伸長ができています。段階的にストライドを伸ばしながら、トップスピードへ移行しましょう。'
        });
      } else if (strideHeightRatio >= 0.75 && strideHeightRatio < 0.85) {
        evaluations.push({
          category: 'ストライド/身長比',
          score: 'good',
          icon: '✅',
          message: `ストライド/身長比: ${strideHeightRatio.toFixed(2)} (${avgStride.toFixed(2)}m / ${heightCm}cm) - 加速初期として良好`,
          advice: '加速初期として適切なストライド/身長比です。股関節伸展を活用して、段階的にストライドを伸ばしていきましょう。'
        });
      } else if (strideHeightRatio > 1.15) {
        evaluations.push({
          category: 'ストライド/身長比',
          score: 'fair',
          icon: '⚠️',
          message: `ストライド/身長比: ${strideHeightRatio.toFixed(2)} (${avgStride.toFixed(2)}m / ${heightCm}cm) - 加速局面で大きすぎる`,
          advice: '加速局面でストライドが大きすぎる可能性があります。加速初期は小さなストライドから始め、段階的に伸ばすことで効率的な加速が可能です。'
        });
      } else {
        evaluations.push({
          category: 'ストライド/身長比',
          score: 'fair',
          icon: '⚠️',
          message: `ストライド/身長比: ${strideHeightRatio.toFixed(2)} (${avgStride.toFixed(2)}m / ${heightCm}cm) - やや小さい`,
          advice: 'ストライドが身長に対してやや小さいです。股関節の伸展動作を意識して、効率的にストライドを伸ばしましょう。'
        });
      }
    } else {
      // トップスピード時の評価
      if (strideHeightRatio >= excellentMin && strideHeightRatio <= excellentMax) {
        evaluations.push({
          category: 'ストライド/身長比',
          score: 'excellent',
          icon: '✅',
          message: `ストライド/身長比: ${strideHeightRatio.toFixed(2)} (${avgStride.toFixed(2)}m / ${heightCm}cm) - エリートレベル`,
          advice: `素晴らしいストライド/身長比です。身長${heightCm}cmに対して${avgStride.toFixed(2)}mのストライドは、エリートスプリンターの水準です。${isFemale ? '女子' : isMale ? '男子' : ''}の最適範囲（${excellentMin}〜${excellentMax}）に入っています。`
        });
      } else if (strideHeightRatio >= goodMin && strideHeightRatio < excellentMin) {
        evaluations.push({
          category: 'ストライド/身長比',
          score: 'good',
          icon: '✅',
          message: `ストライド/身長比: ${strideHeightRatio.toFixed(2)} (${avgStride.toFixed(2)}m / ${heightCm}cm) - 良好`,
          advice: `良好なストライド/身長比です。身長${heightCm}cmの場合、${(heightM * excellentMin).toFixed(2)}m以上のストライドを目指すとエリートレベルに到達できます。股関節の可動域向上とキック力強化に取り組みましょう。`
        });
      } else if (strideHeightRatio > excellentMax && strideHeightRatio <= goodMax) {
        evaluations.push({
          category: 'ストライド/身長比',
          score: 'good',
          icon: '✅',
          message: `ストライド/身長比: ${strideHeightRatio.toFixed(2)} (${avgStride.toFixed(2)}m / ${heightCm}cm) - ストライド型`,
          advice: `ストライド型の走りです。身長に対して大きなストライドを獲得できていますが、ピッチとのバランスを確認しましょう。オーバーストライドにならないよう、接地位置に注意してください。`
        });
      } else if (strideHeightRatio < goodMin) {
        evaluations.push({
          category: 'ストライド/身長比',
          score: 'fair',
          icon: '⚠️',
          message: `ストライド/身長比: ${strideHeightRatio.toFixed(2)} (${avgStride.toFixed(2)}m / ${heightCm}cm) - 改善の余地あり`,
          advice: `身長${heightCm}cmに対してストライドが短めです。研究データによると、最大疾走スピード達成には身長の${(excellentMin * 100).toFixed(0)}〜${(excellentMax * 100).toFixed(0)}%程度（${(heightM * excellentMin).toFixed(2)}〜${(heightM * excellentMax).toFixed(2)}m）のストライドが理想です。股関節の可動域拡大とハムストリングス・大臀筋の強化に取り組みましょう。`
        });
      } else {
        evaluations.push({
          category: 'ストライド/身長比',
          score: 'fair',
          icon: '⚠️',
          message: `ストライド/身長比: ${strideHeightRatio.toFixed(2)} (${avgStride.toFixed(2)}m / ${heightCm}cm) - オーバーストライドの可能性`,
          advice: `ストライドが身長に対して大きすぎます。オーバーストライドは接地時のブレーキ力を増加させ、効率を低下させます。身体の真下に近い位置で接地し、${(excellentMax * 100).toFixed(0)}%以下（${(heightM * excellentMax).toFixed(2)}m以下）を目指しましょう。`
        });
      }
    }
  }

  // 3. 接地時間評価 - 局面別の評価基準
  // 【科学的根拠】苅山先生資料より：
  // - 加速局面: 長い接地時間・短い滞空時間 → 高重心・短い接地時間・長い滞空時間へ変化
  // - 最大速度発揮局面: 短い支持時間で後方までキック
  const avgContact = stepSummary.avgContact ?? 0;
  
  if (avgContact > 0) {
    if (analysisType === 'acceleration') {
      // 加速局面：接地時間は比較的長くても問題ない（推進力獲得に必要）
      // スタート直後は0.15-0.20秒程度が適正
      if (avgContact >= 0.12 && avgContact <= 0.18) {
        evaluations.push({
          category: '接地時間（加速局面）',
          score: 'excellent',
          icon: '✅',
          message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 加速局面として理想的',
          advice: '加速局面に適した接地時間です。支持期で十分な推進力を得ながら、効率的に加速できています。「支持期でしか加速できない」という原則を活かせています。'
        });
      } else if (avgContact >= 0.18 && avgContact <= 0.22) {
        evaluations.push({
          category: '接地時間（加速局面）',
          score: 'good',
          icon: '✅',
          message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 良好（加速局面）',
          advice: '加速局面として許容範囲の接地時間です。スタート直後は地面を押す時間が必要ですが、歩数が増えるにつれて短縮していくことが重要です。'
        });
      } else if (avgContact > 0.22 && avgContact <= 0.28) {
        evaluations.push({
          category: '接地時間（加速局面）',
          score: 'fair',
          icon: '⚠️',
          message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - やや長い（加速局面）',
          advice: '接地時間がやや長いです。加速局面でも股関節伸展の速度を上げることで、接地時間を短縮できます。支持期終盤の加速力発揮を意識し、膝関節の伸展タイミングを遅らせましょう。'
        });
      } else if (avgContact < 0.12) {
        evaluations.push({
          category: '接地時間（加速局面）',
          score: 'fair',
          icon: '⚠️',
          message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 短すぎ（加速局面）',
          advice: '加速局面で接地時間が短すぎます。十分な推進力を得るために、地面を後方へ押す時間を確保しましょう。「支持期でしか加速できない」ため、適切な接地時間が必要です。'
        });
      } else {
        evaluations.push({
          category: '接地時間（加速局面）',
          score: 'poor',
          icon: '❌',
          message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 長すぎる',
          advice: '接地時間が長すぎます。ブレーキ力が増大し、加速効率が低下しています。股関節伸展の速度を上げ、支持期終盤での加速力発揮を意識しましょう。'
        });
      }
    } else {
      // 最大速度発揮局面：短い接地時間が重要
      if (avgContact <= 0.10) {
        evaluations.push({
          category: '接地時間（最大速度）',
          score: 'excellent',
          icon: '✅',
          message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 世界一流レベル',
          advice: '世界一流スプリンター並みの非常に短い接地時間です。「短い支持時間で後方までキック」という理想的な動作ができています。股関節を用いて素早くキックし、素早く引き付けられています。'
        });
      } else if (avgContact <= 0.12) {
        evaluations.push({
          category: '接地時間（最大速度）',
          score: 'excellent',
          icon: '✅',
          message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - エリートレベル',
          advice: 'エリートレベルの短い接地時間です。股関節の高い伸展速度を活かして、効率的に推進力を得ています。'
        });
      } else if (avgContact <= 0.15) {
        evaluations.push({
          category: '接地時間（最大速度）',
          score: 'good',
          icon: '✅',
          message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 良好',
          advice: '良好な接地時間です。120ms以下を目指すと、さらに高速での疾走が可能になります。膝・足関節の伸展を強調せず、股関節伸展速度を高めることがポイントです。'
        });
      } else if (avgContact <= 0.18) {
        evaluations.push({
          category: '接地時間（最大速度）',
          score: 'fair',
          icon: '⚠️',
          message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 改善の余地あり',
          advice: '接地時間の短縮が必要です。研究によると、優れたスプリンターは「股関節の伸展速度が高く、膝・足関節の伸展を強調していない」ことが特徴です。脚の屈伸を小さくし、素早い引き付けを意識しましょう。'
        });
      } else {
        evaluations.push({
          category: '接地時間（最大速度）',
          score: 'poor',
          icon: '❌',
          message: '接地時間: ' + (avgContact * 1000).toFixed(0) + 'ms - 長すぎる',
          advice: '接地時間が長すぎます。最大速度維持には「短い支持時間で後方までキック」することが重要です。地面を蹴る意識を捨て、股関節を用いて素早くキックし、素早く引き付けることに集中しましょう。'
        });
      }
    }
  }

  // 4. 接地時間と滞空時間のバランス - 局面別評価
  // 【科学的根拠】苅山先生資料より：
  // - 加速局面: 長い接地時間・短い滞空時間 → 変化していく
  // - 最大速度発揮局面: 短い接地時間・長い滞空時間
  // - 「接地時間が短く滞空時間が長くなり、加速に必要な地面反力が得られなくなる」と加速が止まる
  const avgFlight = stepSummary.avgFlight ?? 0;
  
  if (avgContact > 0 && avgFlight > 0) {
    const contactFlightRatio = avgContact / avgFlight;
    
    if (analysisType === 'acceleration') {
      // 加速局面：接地/滞空比は高め（接地時間 > 滞空時間）が理想
      if (contactFlightRatio >= 1.0 && contactFlightRatio <= 2.0) {
        evaluations.push({
          category: '接地・滞空バランス（加速）',
          score: 'excellent',
          icon: '✅',
          message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - 加速局面として理想的',
          advice: '加速局面に適したバランスです。「支持期でしか加速できない」という原則に従い、十分な接地時間で推進力を得ています。滞空期は次の支持期のための準備局面として機能しています。'
        });
      } else if (contactFlightRatio >= 0.8 && contactFlightRatio < 1.0) {
        evaluations.push({
          category: '接地・滞空バランス（加速）',
          score: 'good',
          icon: '✅',
          message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - 良好（トップスピードへの移行期）',
          advice: '加速後半からトップスピードへの移行期に適したバランスです。段階的に滞空時間が長くなっていくパターンです。'
        });
      } else if (contactFlightRatio > 2.0) {
        evaluations.push({
          category: '接地・滞空バランス（加速）',
          score: 'fair',
          icon: '⚠️',
          message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - 接地時間が長すぎ',
          advice: '接地時間が滞空時間に比べて長すぎます。地面反力の方向を意識し、より効率的に推進力を得ましょう。「力の大きさよりその方向が重要」です。'
        });
      } else {
        evaluations.push({
          category: '接地・滞空バランス（加速）',
          score: 'fair',
          icon: '⚠️',
          message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - 滞空時間が長すぎ（加速局面）',
          advice: '加速局面で滞空時間が長すぎます。十分な推進力を得るために、接地時間を確保することが重要です。早期に体幹を起こしすぎている可能性があります。'
        });
      }
    } else {
      // 最大速度発揮局面：接地/滞空比は低め（接地時間 < 滞空時間）が理想
      if (contactFlightRatio >= 0.6 && contactFlightRatio <= 0.9) {
        evaluations.push({
          category: '接地・滞空バランス（最大速度）',
          score: 'excellent',
          icon: '✅',
          message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - 最大速度発揮に理想的',
          advice: '最大速度発揮に理想的なバランスです。短い接地時間で効率的に推進力を得て、滞空期で次の接地に備えています。世界一流スプリンターのパターンです。'
        });
      } else if (contactFlightRatio >= 0.9 && contactFlightRatio <= 1.1) {
        evaluations.push({
          category: '接地・滞空バランス（最大速度）',
          score: 'good',
          icon: '✅',
          message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - バランス良好',
          advice: '良好なバランスです。接地時間をさらに短縮することで、より高速での疾走が可能になります。'
        });
      } else if (contactFlightRatio > 1.1) {
        evaluations.push({
          category: '接地・滞空バランス（最大速度）',
          score: 'fair',
          icon: '⚠️',
          message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - 接地時間が長め',
          advice: '接地時間が滞空時間に比べて長いです。最大速度維持には「短い支持時間で後方までキック」することが重要です。脚の引き付けを素早くし、接地時間を短縮しましょう。'
        });
      } else {
        evaluations.push({
          category: '接地・滞空バランス（最大速度）',
          score: 'good',
          icon: '✅',
          message: '接地/滞空比: ' + contactFlightRatio.toFixed(2) + ' - ストライド走法傾向',
          advice: '滞空時間が長いストライド走法の傾向があります。大きなストライドを獲得できていますが、接地時のブレーキに注意しましょう。'
        });
      }
    }
  }

  // 5. 股関節の使い方（大腿角度）- 局面別評価
  // 【科学的根拠】苅山先生資料より：
  // - 優れたスプリンターは「股関節の伸展速度が高い」「膝・足関節の伸展を強調していない」
  // - 「脚の屈伸が小さい」「脚が流れない（引き付けが素早い）」
  // - 「大腿の後方スイングが小さく、下腿の前傾が大きい」
  // - 「股関節を用いて素早くキックし、素早く引き付けている」
  // - 「もも上げ角度、引きつけ角度、振り出し角度は必ずしも速い人が行なっている動作技術ではない」
  const thighAngles = phaseAngles.flatMap(p => [
    p.angles.thighAngle.left,
    p.angles.thighAngle.right
  ]).filter(a => a !== null) as number[];
  
  if (thighAngles.length > 0) {
    const maxThighAngle = Math.max(...thighAngles);
    const minThighAngle = Math.min(...thighAngles);
    const thighRangeOfMotion = maxThighAngle - minThighAngle;
    
    if (analysisType === 'acceleration') {
      // 加速局面：後方へのキック（股関節伸展）が重要
      // 「支持期終盤の大きな加速力発揮が重要」「膝関節の伸展タイミングを遅らせる」
      if (thighRangeOfMotion >= 60) {
        evaluations.push({
          category: '股関節伸展（加速局面）',
          score: 'excellent',
          icon: '✅',
          message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 優秀な股関節伸展',
          advice: '優れた股関節伸展ができています。「支持期終盤の大きな加速力発揮」が実現できており、後方への強いキックで水平推進力を得ています。膝関節の伸展に頼らず、股関節伸展主導で加速できています。'
        });
      } else if (thighRangeOfMotion >= 50) {
        evaluations.push({
          category: '股関節伸展（加速局面）',
          score: 'good',
          icon: '✅',
          message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 良好',
          advice: '良好な股関節の使い方です。さらに股関節伸展を強調し、「支持期終盤の大きな加速力発揮」を意識すると、より効率的な加速が可能です。膝関節の伸展タイミングを遅らせることもポイントです。'
        });
      } else if (thighRangeOfMotion >= 40) {
        evaluations.push({
          category: '股関節伸展（加速局面）',
          score: 'fair',
          icon: '⚠️',
          message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 股関節伸展不足',
          advice: '股関節の伸展が不十分です。加速局面では「力の大きさよりその方向が重要」です。膝や足関節の伸展ではなく、股関節伸展による後方へのキックを意識しましょう。'
        });
      } else {
        evaluations.push({
          category: '股関節伸展（加速局面）',
          score: 'poor',
          icon: '❌',
          message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 大幅な改善が必要',
          advice: '股関節の可動域が小さすぎます。加速には股関節伸展が不可欠です。「膝関節の伸展タイミングを遅らせる」ことを意識し、股関節主導でキックする動作を習得しましょう。'
        });
      }
    } else {
      // 最大速度発揮局面：素早いキックと引き付けが重要
      // 「脚の屈伸が小さい」「脚が流れない（引き付けが素早い）」
      if (thighRangeOfMotion >= 70) {
        evaluations.push({
          category: '股関節の使い方（最大速度）',
          score: 'excellent',
          icon: '✅',
          message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 優秀',
          advice: '股関節の可動域が非常に広く、「股関節を用いて素早くキックし、素早く引き付けて」います。後方への十分なキックと、脚が流れない素早い引き付けができています。世界一流スプリンターの動作特性です。'
        });
      } else if (thighRangeOfMotion >= 60) {
        evaluations.push({
          category: '股関節の使い方（最大速度）',
          score: 'good',
          icon: '✅',
          message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 良好',
          advice: '良好な股関節の使い方です。研究によると、優れたスプリンターは「股関節の伸展速度が高く、膝・足関節の伸展を強調していない」ことが特徴です。70°以上を目指すとさらにダイナミックになります。'
        });
      } else if (thighRangeOfMotion >= 50) {
        evaluations.push({
          category: '股関節の使い方（最大速度）',
          score: 'fair',
          icon: '⚠️',
          message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 改善が必要',
          advice: '股関節の可動域が不足しています。「脚の屈伸が小さく、脚が流れない」ことが重要です。後方へのキックを強調しつつ、引き付けを素早く行うことで改善できます。「もも上げ」を強調する必要はありません。'
        });
      } else {
        evaluations.push({
          category: '股関節の使い方（最大速度）',
          score: 'poor',
          icon: '❌',
          message: '大腿角度の可動域: ' + thighRangeOfMotion.toFixed(0) + '° - 小さすぎる',
          advice: '股関節の可動域が非常に小さいです。「股関節を用いて素早くキックし、素早く引き付ける」動作を習得しましょう。注意：「もも上げ」や「振り出し」を強調することは、必ずしも速さにつながりません。'
        });
      }
    }
  }

  // 総合評価 - 局面別メッセージ
  const scorePoints = {
    excellent: 4,
    good: 3,
    fair: 2,
    poor: 1
  };
  
  const avgScore = evaluations.reduce((sum, e) => sum + scorePoints[e.score], 0) / evaluations.length;
  
  let overallRating = '';
  let overallMessage = '';
  
  if (analysisType === 'acceleration') {
    // 加速局面の総合評価
    if (avgScore >= 3.5) {
      overallRating = 'エリートレベル（加速局面）';
      overallMessage = '素晴らしいスタート加速です。強い前傾姿勢から段階的に起き上がり、股関節伸展主導で効率的に水平推進力を得ています。「支持期終盤の大きな加速力発揮」が実現できています。';
    } else if (avgScore >= 3.0) {
      overallRating = '上級レベル（加速局面）';
      overallMessage = '良好なスタート加速です。姿勢の起き上がりと股関節の使い方を微調整することで、さらに効率的な加速が可能です。「膝関節の伸展タイミングを遅らせる」ことを意識しましょう。';
    } else if (avgScore >= 2.5) {
      overallRating = '中級レベル（加速局面）';
      overallMessage = '加速動作に改善の余地があります。「力の大きさよりその方向が重要」です。45°前後の前傾から始め、8歩程度で段階的に体幹を起こしながら、股関節伸展で地面を後方へ押す意識を持ちましょう。';
    } else {
      overallRating = '初級レベル（加速局面）';
      overallMessage = '加速技術の基礎から見直しが必要です。スタート直後は「低重心・長い接地時間・短い滞空時間」が特徴です。膝を固定したまま股関節伸展でストライドを獲得し、段階的に体幹を起こしていきましょう。';
    }
  } else {
    // 最大速度発揮局面の総合評価
    if (avgScore >= 3.5) {
      overallRating = 'エリートレベル（最大速度）';
      overallMessage = '素晴らしい疾走フォームです。「短い支持時間で後方までキック」し、「股関節を用いて素早くキックし、素早く引き付けて」います。世界一流スプリンターの動作特性を備えています。';
    } else if (avgScore >= 3.0) {
      overallRating = '上級レベル（最大速度）';
      overallMessage = '良好な疾走フォームです。「股関節の伸展速度を高め、膝・足関節の伸展を強調しない」ことで、さらなる速度向上が期待できます。';
    } else if (avgScore >= 2.5) {
      overallRating = '中級レベル（最大速度）';
      overallMessage = '疾走動作に改善の余地があります。研究によると、優れたスプリンターは「脚の屈伸が小さく、脚が流れない（引き付けが素早い）」ことが特徴です。「もも上げ」を強調するより、股関節での素早いキックと引き付けを意識しましょう。';
    } else {
      overallRating = '初級レベル（最大速度）';
      overallMessage = '疾走技術の改善が必要です。「支持期でしか加速できない」という原則を理解し、短い接地時間で効率的に推進力を得る動作を習得しましょう。「もも上げ」「振り出し」は必ずしも速さにつながりません。';
    }
  }

  return {
    evaluations,
    overallRating,
    overallMessage,
    avgScore
  };
}
