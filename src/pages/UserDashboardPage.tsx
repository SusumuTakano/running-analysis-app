// src/pages/UserDashboardPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type RunningAnalysisSession = {
  id: string;
  created_at: string;
  source_video_name: string | null;
  video_filename?: string | null;
  distance_m: number | null;
  section_time_s: number | null;
  avg_speed_mps: number | null;
  avg_stride_m?: number | null;
  avg_cadence_hz?: number | null;
  avg_contact_time_s?: number | null;
  avg_flight_time_s?: number | null;
  frame_count?: number | null;
  frames_count?: number | null;
  target_fps?: number | null;
  source_video_duration_s?: number | null;
  section_start_type?: string | null;
  section_end_type?: string | null;
  section_start_frame?: number | null;
  section_end_frame?: number | null;
  notes?: string | null;
  label: string | null;
  athlete_id?: string | null;
  athlete_name?: string | null;
  [key: string]: any;  // その他のフィールドも許可
};

const UserDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RunningAnalysisSession[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        navigate("/login", { replace: true });
        return;
      }

      setUserEmail(data.session.user.email ?? null);

      // セッションデータの取得（すべてのカラムを取得）
      const { data: sessionsData, error: sessionsError } =
        await supabase
          .from("running_analysis_sessions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
      
      // デバッグ: 取得したデータを確認
      console.log("Sessions data:", sessionsData);
      console.log("Sessions error:", sessionsError);

      if (sessionsError) {
        // カラムが存在しない場合は、基本カラムのみ取得
        if (sessionsError.message.includes('athlete_id') || sessionsError.message.includes('athlete_name')) {
          const { data: basicData, error: basicError } = await supabase
            .from("running_analysis_sessions")
            .select("id, created_at, source_video_name, distance_m, section_time_s, avg_speed_mps, label")
            .order("created_at", { ascending: false })
            .limit(10);
          
          if (basicError) {
            setErrorMsg(basicError.message);
          } else {
            // athlete_idとathlete_nameをnullで補完
            const sessionsWithNull = (basicData ?? []).map(s => ({
              ...s,
              athlete_id: null,
              athlete_name: null,
              session_data: null
            }));
            setSessions(sessionsWithNull);
          }
        } else {
          setErrorMsg(sessionsError.message);
        }
      } else {
        setSessions(sessionsData ?? []);
      }



      setLoading(false);
    };

    load();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  // 詳細表示
  const handleViewDetails = async (session: RunningAnalysisSession) => {
    console.log("Viewing session details:", session);

    const parseJsonField = (value: any): any => {
      if (!value) return null;
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          console.warn("JSONフィールドの解析に失敗:", parseError, value);
          return null;
        }
      }
      return value;
    };

    const analysisData = parseJsonField(session.session_data);
    const sessionMetadata = parseJsonField(session.metadata);
    
    // 詳細データを取得（step_metrics, three_phase_angles, step_summaries）
    let stepMetrics = null;
    let threePhaseAngles = null;
    let stepSummary = null;
    
    try {
      // ステップメトリクスを取得
      const { data: metricsData } = await supabase
        .from('step_metrics')
        .select('*')
        .eq('session_id', session.id)
        .order('step_index', { ascending: true });
        
      if (metricsData && metricsData.length > 0) {
        stepMetrics = metricsData;
      }
      
      // 3局面角度データを取得
      const { data: anglesData } = await supabase
        .from('three_phase_angles')
        .select('*')
        .eq('session_id', session.id)
        .order('step_index', { ascending: true });
        
      if (anglesData && anglesData.length > 0) {
        threePhaseAngles = anglesData;
      }
      
      // ステップサマリーを取得
      const { data: summaryData } = await supabase
        .from('step_summaries')
        .select('*')
        .eq('session_id', session.id)
        .single();
        
      if (summaryData) {
        stepSummary = summaryData;
      }
    } catch (e) {
      console.warn("詳細データの取得に失敗:", e);
    }

    if ((!stepMetrics || stepMetrics.length === 0) && analysisData?.stepMetrics?.length) {
      stepMetrics = analysisData.stepMetrics;
    }

    if ((!threePhaseAngles || threePhaseAngles.length === 0) && analysisData?.threePhaseAngles?.length) {
      threePhaseAngles = analysisData.threePhaseAngles;
    }

    if (!stepSummary && analysisData?.stepSummary) {
      stepSummary = analysisData.stepSummary;
    }
    
    // セッション全体をローカルストレージに保存
    const sessionDataToView = {
      // 基本情報
      id: session.id,
      created_at: session.created_at,
      source_video_name: session.source_video_name || session.video_filename,
      
      // 解析結果
      distance_m: session.distance_m,
      section_time_s: session.section_time_s,
      avg_speed_mps: session.avg_speed_mps,
      avg_stride_m: session.avg_stride_m,
      avg_cadence_hz: session.avg_cadence_hz,
      avg_contact_time_s: session.avg_contact_time_s,
      avg_flight_time_s: session.avg_flight_time_s,
      
      // フレーム情報
      frame_count: session.frame_count,
      frames_count: session.frames_count,
      target_fps: session.target_fps,
      source_video_duration_s: session.source_video_duration_s,
      
      // 区間情報
      section_start_type: session.section_start_type,
      section_end_type: session.section_end_type,
      section_start_frame: session.section_start_frame,
      section_end_frame: session.section_end_frame,
      
      // その他のメタデータ
      notes: session.notes,
      label: session.label,
      
      // 詳細データ（取得できた場合）
      stepMetrics,
      threePhaseAngles,
      stepSummary,
      
      // JSONデータ（session_dataやmetadata）
      session_data: analysisData,
      metadata: sessionMetadata,
      
      // すべてのデータ（念のため）
      _raw: session
    };
    
    // ローカルストレージに保存
    localStorage.setItem('viewSessionData', JSON.stringify(sessionDataToView));
    localStorage.setItem('viewSessionId', session.id);
    
    // 新しいタブで結果ページを開く
    const resultUrl = `/dashboard/session/${session.id}`;
    
    // 結果表示用の簡易HTMLページを生成
    const escapeHtml = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const formatForDisplay = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) return String(value);
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
      }
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value, null, 2);
        } catch {
          return String(value);
        }
      }
      return String(value);
    };

    const aiEvaluationSection = analysisData?.aiEvaluation
      ? `
    <div class="section">
      <h2>🤖 AI評価</h2>
      <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; white-space: pre-wrap; line-height: 1.8; color: #0c4a6e;">
${escapeHtml(String(analysisData.aiEvaluation))}
      </div>
    </div>
    `
      : '';

    const targetAdviceSection = analysisData?.targetAdvice
      ? `
    <div class="section">
      <h2>🎯 100m目標記録アドバイス</h2>
      <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; white-space: pre-wrap; line-height: 1.8; color: #78350f;">
${escapeHtml(String(analysisData.targetAdvice))}
      </div>
    </div>
    `
      : '';

    const analysisMetaItems: { label: string; value: string }[] = [];
    if (analysisData?.analysisType) {
      const label = analysisData.analysisType === 'acceleration' ? '加速局面（スタート）' : analysisData.analysisType === 'topSpeed' ? 'トップスピード局面' : String(analysisData.analysisType);
      analysisMetaItems.push({ label: '解析モード', value: label });
    }
    if (sessionMetadata?.analysis_type && !analysisMetaItems.find(i => i.label === '解析モード')) {
      analysisMetaItems.push({ label: '解析モード', value: String(sessionMetadata.analysis_type) });
    }
    if (analysisData?.timestamp) {
      analysisMetaItems.push({ label: '保存時刻', value: new Date(analysisData.timestamp).toLocaleString('ja-JP') });
    }
    if (typeof analysisData?.avgSpeed === 'number') {
      analysisMetaItems.push({ label: '保存時の平均速度', value: `${analysisData.avgSpeed.toFixed(2)} m/s` });
    } else if (analysisData?.avgSpeed) {
      analysisMetaItems.push({ label: '保存時の平均速度', value: `${analysisData.avgSpeed} m/s` });
    }
    if (analysisData?.distance !== undefined && analysisData?.distance !== null) {
      analysisMetaItems.push({ label: '解析距離', value: `${analysisData.distance} m` });
    }
    if (analysisData?.sectionTime !== undefined && analysisData?.sectionTime !== null) {
      analysisMetaItems.push({ label: '区間時間', value: `${analysisData.sectionTime} 秒` });
    }

    const analysisMetaSection = analysisMetaItems.length
      ? `
    <div class="section">
      <h2>🧾 解析メタ情報</h2>
      <div class="metrics">
        ${analysisMetaItems
          .map(
            (item) => `
        <div class="metric-card">
          <div class="metric-label">${escapeHtml(item.label)}</div>
          <div class="metric-value">${escapeHtml(item.value)}</div>
        </div>`
          )
          .join('')}
      </div>
    </div>
    `
      : '';

    const athleteInfoEntries = analysisData?.athleteInfo
      ? Object.entries(analysisData.athleteInfo).filter(([_, value]) => value !== null && value !== undefined && value !== '')
      : [];

    const athleteInfoSection = athleteInfoEntries.length
      ? `
    <div class="section">
      <h2>👤 選手情報</h2>
      <div class="metrics">
        ${athleteInfoEntries
          .map(
            ([key, value]) => `
        <div class="metric-card">
          <div class="metric-label">${escapeHtml(key)}</div>
          <div class="metric-value">${escapeHtml(formatForDisplay(value))}</div>
        </div>`
          )
          .join('')}
      </div>
    </div>
    `
      : '';

    const metadataEntries = sessionMetadata
      ? Object.entries(sessionMetadata).filter(([_, value]) => value !== null && value !== undefined && value !== '')
      : [];

    const metadataSection = metadataEntries.length
      ? `
    <div class="section">
      <h2>📂 メタデータ</h2>
      <div class="metrics">
        ${metadataEntries
          .map(
            ([key, value]) => `
        <div class="metric-card">
          <div class="metric-label">${escapeHtml(key)}</div>
          <div class="metric-value">${escapeHtml(formatForDisplay(value))}</div>
        </div>`
          )
          .join('')}
      </div>
    </div>
    `
      : '';

    const resultHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>解析結果 - ${session.source_video_name || 'Session ' + session.id}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      margin: 0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #1a202c;
      border-bottom: 3px solid #667eea;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section h2 {
      color: #2d3748;
      font-size: 1.5rem;
      margin-bottom: 16px;
      padding-left: 12px;
      border-left: 4px solid #764ba2;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }
    .metric-card {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .metric-label {
      font-size: 0.875rem;
      color: #718096;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #2d3748;
    }
    .metric-unit {
      font-size: 0.875rem;
      color: #718096;
      margin-left: 4px;
    }
    .back-button {
      display: inline-block;
      padding: 12px 24px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      margin-bottom: 24px;
      transition: background 0.2s;
    }
    .back-button:hover {
      background: #5a67d8;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/dashboard" class="back-button">← ダッシュボードに戻る</a>
    
    <h1>🏃 解析結果詳細</h1>
    
    <div class="section">
      <h2>基本情報</h2>
      <div class="metrics">
        <div class="metric-card">
          <div class="metric-label">セッションID</div>
          <div class="metric-value">${session.id.slice(0, 8)}...</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">解析日時</div>
          <div class="metric-value">${new Date(session.created_at).toLocaleString('ja-JP')}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">動画名</div>
          <div class="metric-value">${session.source_video_name || session.video_filename || '-'}</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>走行データ</h2>
      <div class="metrics">
        <div class="metric-card">
          <div class="metric-label">距離</div>
          <div class="metric-value">${session.distance_m || '-'}<span class="metric-unit">m</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">区間時間</div>
          <div class="metric-value">${session.section_time_s || '-'}<span class="metric-unit">秒</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">平均速度</div>
          <div class="metric-value">${session.avg_speed_mps ? session.avg_speed_mps.toFixed(2) : '-'}<span class="metric-unit">m/s</span></div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>ストライド分析</h2>
      <div class="metrics">
        <div class="metric-card">
          <div class="metric-label">平均ストライド</div>
          <div class="metric-value">${session.avg_stride_m ? session.avg_stride_m.toFixed(2) : '-'}<span class="metric-unit">m</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">平均ケイデンス</div>
          <div class="metric-value">${session.avg_cadence_hz ? session.avg_cadence_hz.toFixed(2) : '-'}<span class="metric-unit">Hz</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">平均接地時間</div>
          <div class="metric-value">${session.avg_contact_time_s ? session.avg_contact_time_s.toFixed(3) : '-'}<span class="metric-unit">秒</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">平均滞空時間</div>
          <div class="metric-value">${session.avg_flight_time_s ? session.avg_flight_time_s.toFixed(3) : '-'}<span class="metric-unit">秒</span></div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>フレーム情報</h2>
      <div class="metrics">
        <div class="metric-card">
          <div class="metric-label">総フレーム数</div>
          <div class="metric-value">${session.frame_count || session.frames_count || '-'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">ターゲットFPS</div>
          <div class="metric-value">${session.target_fps || '-'}<span class="metric-unit">fps</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">動画時間</div>
          <div class="metric-value">${session.source_video_duration_s ? session.source_video_duration_s.toFixed(2) : '-'}<span class="metric-unit">秒</span></div>
        </div>
      </div>
    </div>
    
    ${stepSummary ? `
    <div class="section">
      <h2>📊 ステップ統計サマリー</h2>
      <div class="metrics">
        <div class="metric-card">
          <div class="metric-label">総ステップ数</div>
          <div class="metric-value">${stepSummary.total_steps || '-'}<span class="metric-unit">歩</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">平均ストライド長</div>
          <div class="metric-value">${stepSummary.avg_stride_length ? stepSummary.avg_stride_length.toFixed(2) : '-'}<span class="metric-unit">m</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">平均接地時間</div>
          <div class="metric-value">${stepSummary.avg_contact_time ? (stepSummary.avg_contact_time * 1000).toFixed(1) : '-'}<span class="metric-unit">ms</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label">平均滞空時間</div>
          <div class="metric-value">${stepSummary.avg_flight_time ? (stepSummary.avg_flight_time * 1000).toFixed(1) : '-'}<span class="metric-unit">ms</span></div>
        </div>
      </div>
    </div>
    ` : ''}
    
    ${stepMetrics && stepMetrics.length > 0 ? `
    <div class="section">
      <h2>👟 各ステップ詳細データ</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f7fafc;">
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">ステップ</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">接地時間</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">滞空時間</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">ストライド</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">速度</th>
            </tr>
          </thead>
          <tbody>
            ${stepMetrics.slice(0, 10).map((metric: any, idx: number) => `
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">#${idx + 1}</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${metric.contact_time ? (metric.contact_time * 1000).toFixed(1) : '-'} ms</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${metric.flight_time ? (metric.flight_time * 1000).toFixed(1) : '-'} ms</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${metric.stride_length ? metric.stride_length.toFixed(2) : '-'} m</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${metric.speed ? metric.speed.toFixed(2) : '-'} m/s</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
        ${stepMetrics.length > 10 ? `<p style="margin-top: 10px; color: #718096;">※ 最初の10ステップのみ表示（全${stepMetrics.length}ステップ中）</p>` : ''}
      </div>
    </div>
    ` : ''}
    
    ${threePhaseAngles && threePhaseAngles.length > 0 ? `
    <div class="section">
      <h2>📐 3局面角度データ（代表値）</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f7fafc;">
              <th style="padding: 8px; border: 1px solid #e2e8f0;">局面</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">股関節</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">膝関節</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">足関節</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">体幹</th>
            </tr>
          </thead>
          <tbody>
            ${['contact', 'mid_support', 'toe_off'].map((phase: string) => {
              const phaseData = threePhaseAngles.find((a: any) => a.phase === phase);
              const phaseName = phase === 'contact' ? '接地' : phase === 'mid_support' ? '中間支持' : '離地';
              return phaseData ? `
              <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${phaseName}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">${phaseData.hip_angle ? phaseData.hip_angle.toFixed(1) : '-'}°</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">${phaseData.knee_angle ? phaseData.knee_angle.toFixed(1) : '-'}°</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">${phaseData.ankle_angle ? phaseData.ankle_angle.toFixed(1) : '-'}°</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">${phaseData.trunk_angle ? phaseData.trunk_angle.toFixed(1) : '-'}°</td>
              </tr>
              ` : '';
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}
    
    ${analysisMetaSection}
    ${athleteInfoSection}
    ${aiEvaluationSection}
    ${targetAdviceSection}
    ${metadataSection}
    
    ${session.notes ? `
    <div class="section">
      <h2>📝 備考</h2>
      <p style="background: #f7fafc; padding: 16px; border-radius: 8px; line-height: 1.6;">
        ${session.notes}
      </p>
    </div>
    ` : ''}
    
    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; color: #718096;">
      <p>解析日時: ${new Date(session.created_at).toLocaleString('ja-JP')}</p>
      <p>Session ID: ${session.id}</p>
    </div>
  </div>
</body>
</html>
    `;
    
    // 新しいウィンドウで結果を表示
    const resultWindow = window.open('', '_blank');
    if (resultWindow) {
      resultWindow.document.write(resultHtml);
      resultWindow.document.close();
    } else {
      alert('ポップアップがブロックされました。ポップアップを許可してください。');
    }
  };

  // ラベル編集
  const handleEditSession = (session: RunningAnalysisSession) => {
    const newLabel = prompt('ラベルを編集:', session.label || '');
    if (newLabel !== null) {
      updateSessionLabel(session.id, newLabel);
    }
  };

  // ラベルの更新
  const updateSessionLabel = async (sessionId: string, newLabel: string) => {
    const { error } = await supabase
      .from('running_analysis_sessions')
      .update({ label: newLabel })
      .eq('id', sessionId);
    
    if (error) {
      alert('更新に失敗しました: ' + error.message);
    } else {
      // リロード
      window.location.reload();
    }
  };



  // セッションの削除
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('このセッションを削除してもよろしいですか？')) return;
    
    const { error } = await supabase
      .from('running_analysis_sessions')
      .delete()
      .eq('id', sessionId);
    
    if (error) {
      alert('削除に失敗しました: ' + error.message);
    } else {
      // リロード
      window.location.reload();
    }
  };

  const totalSessions = sessions.length;
  const lastSession = sessions[0] ?? null;
  const lastDateText = lastSession
    ? new Date(lastSession.created_at).toLocaleString("ja-JP")
    : "まだ解析はありません";

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
        }}
      >
        読み込み中です…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* ヘッダー（白カード） */}
        <header
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 16,
            background: "rgba(255,255,255,0.96)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid rgba(15, 23, 42, 0.08)",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                marginBottom: 4,
                color: "#0f172a",
              }}
            >
              ユーザーページ
            </h1>
            <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
              コーチ／サイエンティスト用マイページです。
              <br />
              ログイン中：{userEmail ?? "不明なユーザー"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => navigate("/")}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid #2563eb",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              新しい解析を開始 →
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "none",
                background: "#ef4444",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ログアウト
            </button>
          </div>
        </header>

        {/* サマリーカード（白系） */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <SummaryCard
            title="解析セッション数（直近10件）"
            value={`${totalSessions} 件`}
            caption="直近 10 件分の解析履歴を表示しています。"
          />
          <SummaryCard
            title="最新の解析日時"
            value={lastDateText}
            caption="最新の解析セッション作成日時"
          />
          <SummaryCard
            title="選手管理"
            value="複数選手の登録・管理"
            caption="担当選手を登録しておくと、今後の解析結果を選手ごとに整理できます。"
          />
        </div>

        {/* 選手管理へのリンク（白カード） */}
        <div
          style={{
            marginBottom: 24,
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(15,23,42,0.06)",
          }}
        >
          <Link
            to="/athletes"
            style={{
              display: "inline-block",
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid #0f766e",
              fontSize: 12,
              color: "#065f46",
              background: "#ecfdf5",
              fontWeight: 600,
            }}
          >
            選手管理ページを開く →
          </Link>
        </div>

        {/* 最近の解析一覧（白カードテーブル） */}
        <section
          style={{
            padding: 16,
            borderRadius: 16,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(15,23,42,0.06)",
            boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
          }}
        >
          <h2
            style={{
              fontSize: 18,
              marginBottom: 4,
              color: "#111827",
            }}
          >
            最近の解析セッション
          </h2>
          <p
            style={{
              fontSize: 13,
              marginBottom: 12,
              color: "#4b5563",
            }}
          >
            詳細ボタンをクリックすると解析結果を確認できます。
          </p>

          {errorMsg && (
            <div
              style={{
                marginBottom: 12,
                padding: 8,
                borderRadius: 8,
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: 12,
              }}
            >
              {errorMsg}
            </div>
          )}

          {sessions.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: 12,
                border: "1px dashed rgba(148,163,184,0.9)",
                background: "#f9fafb",
                fontSize: 13,
                color: "#4b5563",
                textAlign: "center",
              }}
            >
              まだ解析セッションはありません。
              <br />
              上の「新しい解析を開始」から動画をアップロードしてみてください。
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.6)",
                background: "#f9fafb",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                  color: "#111827",
                }}
              >
                <thead>
                  <tr style={{ background: "#e5edff" }}>
                    <th style={thStyle}>日時</th>
                    <th style={thStyle}>動画名</th>
                    <th style={thStyle}>距離(m)</th>
                    <th style={thStyle}>区間時間(s)</th>
                    <th style={thStyle}>平均速度(m/s)</th>
                    <th style={thStyle}>ラベル</th>
                    <th style={thStyle}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td style={tdStyle}>
                        {new Date(s.created_at).toLocaleString("ja-JP")}
                      </td>
                      <td style={tdStyle}>
                        {s.source_video_name || s.video_filename || "-"}
                      </td>
                      <td style={tdStyle}>{s.distance_m ?? "-"}</td>
                      <td style={tdStyle}>{s.section_time_s ?? "-"}</td>
                      <td style={tdStyle}>
                        {s.avg_speed_mps ? s.avg_speed_mps.toFixed(2) : "-"}
                      </td>
                      <td style={tdStyle}>{s.label ?? "-"}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => handleViewDetails(s)}
                          style={{
                            padding: "4px 8px",
                            fontSize: 11,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "white",
                            color: "#3b82f6",
                            cursor: "pointer",
                            marginRight: 4
                          }}
                        >
                          詳細
                        </button>
                        <button
                          onClick={() => handleEditSession(s)}
                          style={{
                            padding: "4px 8px",
                            fontSize: 11,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "white",
                            color: "#10b981",
                            cursor: "pointer",
                            marginRight: 4
                          }}
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDeleteSession(s.id)}
                          style={{
                            padding: "4px 8px",
                            fontSize: 11,
                            borderRadius: 4,
                            border: "1px solid #fca5a5",
                            background: "#fef2f2",
                            color: "#ef4444",
                            cursor: "pointer"
                          }}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

type SummaryCardProps = {
  title: string;
  value: string;
  caption?: string;
};

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, caption }) => {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(148,163,184,0.6)",
        boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          marginBottom: 4,
          color: "#6b7280",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 4,
          color: "#111827",
        }}
      >
        {value}
      </div>
      {caption && (
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            color: "#6b7280",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #cbd5f5",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

export default UserDashboardPage;
