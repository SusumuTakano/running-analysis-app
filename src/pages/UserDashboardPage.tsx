// src/pages/UserDashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
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
  section_frame_count?: number | null;
  notes?: string | null;
  label: string | null;
  athlete_id?: string | null;
  athlete_name?: string | null;
  [key: string]: any;  // その他のフィールドも許可
};

type PhaseSnapshot = {
  stepIndex: number | null;
  phase: string | null;
  frame: number | null;
  image?: string | null;
  label?: string | null;
};

type SessionDetailData = {
  session: RunningAnalysisSession;
  analysisData: any;
  metadata: any;
  stepMetrics: any[];
  threePhaseAngles: any[];
  stepSummary: any | null;
  phaseSnapshots: PhaseSnapshot[];
  sessionView: Record<string, any>;
};

type DetailTab = "overview" | "stepMetrics" | "step9" | "aiAdvice" | "raw";

type SessionDetailModalProps = {
  open: boolean;
  data: SessionDetailData | null;
  loading: boolean;
  error: string | null;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
};

type NormalizedPhaseAngle = {
  stepIndex: number | null;
  phaseKey: string;
  phaseLabel: string;
  frame: number | null;
  trunkAngle: number | null;
  thighLeft: number | null;
  thighRight: number | null;
  toeDistanceLeft: number | null;
  toeDistanceRight: number | null;
  kneeLeft: number | null;
  kneeRight: number | null;
  elbowLeft: number | null;
  elbowRight: number | null;
};

const toNumber = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumber = (value: number | null, digits = 2, suffix = "") => {
  if (value === null || value === undefined) return "ー";
  const formatted = Number(value).toFixed(digits);
  return `${formatted}${suffix}`;
};

const formatSeconds = (value: number | null, digits = 3) =>
  value === null ? "ー" : `${value.toFixed(digits)} s`;

const formatMilliseconds = (value: number | null) =>
  value === null ? "ー" : `${(value * 1000).toFixed(1)} ms`;

const formatMeters = (value: number | null, digits = 2) => formatNumber(value, digits, " m");

const formatStepsPerSecond = (value: number | null) =>
  value === null ? "ー" : `${value.toFixed(2)} 歩/s`;

const formatSpeed = (value: number | null) => formatNumber(value, 2, " m/s");

const formatAcceleration = (value: number | null) => {
  if (value === null) return "ー";
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(2)} m/s²`;
};

const formatPercent = (value: number | null) =>
  value === null ? "ー" : `${(value * 100).toFixed(0)}%`;

const formatAngle = (value: number | null, digits = 1) =>
  value === null ? "ー" : `${Number(value).toFixed(digits)}°`;

const formatDistanceCm = (value: number | null, digits = 1) =>
  value === null ? "ー" : `${Number(value).toFixed(digits)}cm`;

const getMetricNumber = (metric: any, keys: string[]): number | null => {
  for (const key of keys) {
    const val = toNumber(metric?.[key]);
    if (val !== null) {
      return val;
    }
  }
  return null;
};

const formatDisplayValue = (value: any): string => {
  if (value === null || value === undefined) return "ー";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      console.warn("Failed to stringify value", error);
      return String(value);
    }
  }
  return String(value);
};

const renderMultiline = (text: string) => {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  return lines.map((line, idx) => (
    <React.Fragment key={`line-${idx}`}>
      {line}
      {idx < lines.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
};

const PHASE_LABEL_MAP: Record<string, string> = {
  contact: "接地期前半 (接地)",
  initial: "接地期前半 (接地)",
  mid: "接地期中半 (垂直)",
  mid_support: "接地期中半 (垂直)",
  midsupport: "接地期中半 (垂直)",
  toe_off: "接地期後半 (離地)",
  toeoff: "接地期後半 (離地)",
  final: "接地期後半 (離地)",
};

const resolvePhaseLabel = (phase?: string | null) => {
  if (!phase) return "不明な局面";
  const key = phase.toLowerCase();
  return PHASE_LABEL_MAP[key] ?? phase;
};

const normalizePhaseAngles = (items: any[]): NormalizedPhaseAngle[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => {
    const phase = item?.phase ?? item?.phase_name ?? item?.phaseName ?? null;
    const frame = toNumber(
      item?.frame ?? item?.frame_index ?? item?.frameIndex ?? item?.step_index ?? idx
    );
    const stepIndex = toNumber(
      item?.step_index ??
        item?.stepIndex ??
        item?.step_number ??
        item?.stepNumber ??
        item?.step ??
        item?.index ??
        null
    );
    const angles = item?.angles ?? {};
    const thighInfo = angles?.thighAngle ?? {};
    const toeInfo = angles?.toeHorizontalDistance ?? {};
    const kneeInfo = angles?.kneeFlex ?? {};
    const elbowInfo = angles?.elbowAngle ?? {};

    const phaseKeyNormalized =
      typeof phase === "string" ? phase.toLowerCase() : `phase-${idx}`;

    return {
      stepIndex,
      phaseKey: phaseKeyNormalized ?? `phase-${idx}`,
      phaseLabel: resolvePhaseLabel(phase),
      frame,
      trunkAngle: toNumber(angles?.trunkAngle ?? item?.trunkAngle ?? item?.trunk_angle),
      thighLeft: toNumber(
        thighInfo?.left ?? item?.thighAngle?.left ?? item?.left_thigh_angle ?? item?.thigh_left
      ),
      thighRight: toNumber(
        thighInfo?.right ?? item?.thighAngle?.right ?? item?.right_thigh_angle ?? item?.thigh_right
      ),
      toeDistanceLeft: toNumber(
        toeInfo?.left ?? item?.toeHorizontalDistance?.left ?? item?.left_toe_distance ?? item?.toe_distance_left
      ),
      toeDistanceRight: toNumber(
        toeInfo?.right ?? item?.toeHorizontalDistance?.right ?? item?.right_toe_distance ?? item?.toe_distance_right
      ),
      kneeLeft: toNumber(kneeInfo?.left ?? item?.kneeFlex?.left ?? item?.left_knee_angle),
      kneeRight: toNumber(kneeInfo?.right ?? item?.kneeFlex?.right ?? item?.right_knee_angle),
      elbowLeft: toNumber(elbowInfo?.left ?? item?.elbowAngle?.left ?? item?.left_elbow_angle),
      elbowRight: toNumber(elbowInfo?.right ?? item?.elbowAngle?.right ?? item?.right_elbow_angle),
    };
  });
};

const buildPhaseSnapshots = (
  analysisData: any,
  sessionMetadata: any
): PhaseSnapshot[] => {
  const candidates = [
    analysisData?.phaseSnapshots,
    analysisData?.phase_snapshots,
    analysisData?.phaseImages,
    analysisData?.phase_images,
    analysisData?.threePhaseSnapshots,
    sessionMetadata?.phaseSnapshots,
    sessionMetadata?.phase_snapshots,
  ];

  return candidates
    .filter((candidate): candidate is any[] => Array.isArray(candidate))
    .flat()
    .map((item: any): PhaseSnapshot => ({
      stepIndex: toNumber(item?.stepIndex ?? item?.step_index ?? item?.step ?? null),
      phase: item?.phase ?? item?.phaseName ?? item?.phase_name ?? null,
      frame: toNumber(item?.frame ?? item?.frameIndex ?? item?.frame_index ?? null),
      image:
        item?.image ??
        item?.imageUrl ??
        item?.image_url ??
        item?.dataUrl ??
        item?.data_url ??
        null,
      label: item?.label ?? null,
    }))
    .filter(
      (snapshot) =>
        snapshot.image ||
        snapshot.stepIndex !== null ||
        snapshot.frame !== null ||
        snapshot.phase !== null
    );
};

const PHASE_ORDER_PRIORITY = [
  "contact",
  "initial",
  "mid_support",
  "mid",
  "midsupport",
  "toe_off",
  "toeoff",
  "final",
];

const getPhaseOrderIndex = (phaseKey: string) => {
  const normalized = phaseKey.toLowerCase();
  const foundIndex = PHASE_ORDER_PRIORITY.findIndex((key) => normalized.includes(key));
  return foundIndex === -1 ? PHASE_ORDER_PRIORITY.length : foundIndex;
};

const average = (values: number[]) => {
  if (!values.length) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
};

const DETAIL_TAB_ITEMS: { key: DetailTab; label: string }[] = [
  { key: "overview", label: "概要" },
  { key: "stepMetrics", label: "ステップ指標" },
  { key: "step9", label: "Step 9 / 三局面" },
  { key: "aiAdvice", label: "AIアドバイス" },
  { key: "raw", label: "保存データ" },
];

const UserDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RunningAnalysisSession[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

<<<<<<< HEAD
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<SessionDetailData | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
=======
>>>>>>> origin/genspark_ai_developer

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
<<<<<<< HEAD
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailData(null);
    setDetailTab("overview");

    try {
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

      const stepMetricsFromJson = Array.isArray(analysisData?.stepMetrics)
        ? analysisData.stepMetrics
        : [];
      const threePhaseAnglesFromJson = Array.isArray(analysisData?.threePhaseAngles)
        ? analysisData.threePhaseAngles
        : [];
      const stepSummaryFromJson = analysisData?.stepSummary ?? null;

      let stepMetricsDb: any[] = [];
      let threePhaseAnglesDb: any[] = [];
      let stepSummaryDb: any | null = null;

      try {
        const [
          { data: metricsData, error: metricsError },
          { data: anglesData, error: anglesError },
          { data: summaryData, error: summaryError },
        ] = await Promise.all([
          supabase
            .from("step_metrics")
            .select("*")
            .eq("session_id", session.id)
            .order("step_index", { ascending: true }),
          supabase
            .from("three_phase_angles")
            .select("*")
            .eq("session_id", session.id)
            .order("step_index", { ascending: true }),
          supabase
            .from("step_summaries")
            .select("*")
            .eq("session_id", session.id)
            .limit(1),
        ]);

        if (metricsError) {
          console.warn("step_metrics fetch error:", metricsError);
        } else if (Array.isArray(metricsData)) {
          stepMetricsDb = metricsData;
        }

        if (anglesError) {
          console.warn("three_phase_angles fetch error:", anglesError);
        } else if (Array.isArray(anglesData)) {
          threePhaseAnglesDb = anglesData;
        }

        if (summaryError) {
          console.warn("step_summaries fetch error:", summaryError);
        } else if (Array.isArray(summaryData) && summaryData.length > 0) {
          stepSummaryDb = summaryData[0];
        }
      } catch (detailFetchError) {
        console.warn("詳細データの取得に失敗:", detailFetchError);
      }

      const mergeByKey = (
        primary: any[],
        secondary: any[],
        keySelector: (item: any, idx: number) => string
      ) => {
        const map = new Map<string, any>();
        const orderMap = new Map<string, number>();

        secondary.forEach((item, idx) => {
          const key = keySelector(item, idx);
          if (!orderMap.has(key)) {
            orderMap.set(key, orderMap.size);
          }
          const existing = map.get(key);
          if (existing) {
            map.set(key, { ...item, ...existing });
          } else {
            map.set(key, { ...item });
          }
        });

        primary.forEach((item, idx) => {
          const key = keySelector(item, idx);
          if (!orderMap.has(key)) {
            orderMap.set(key, orderMap.size);
          }
          const existing = map.get(key) ?? {};
          map.set(key, { ...existing, ...item });
        });

        return Array.from(map.entries())
          .sort((a, b) => {
            const orderA = orderMap.get(a[0]) ?? 0;
            const orderB = orderMap.get(b[0]) ?? 0;
            if (orderA === orderB) {
              return a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" });
            }
            return orderA - orderB;
          })
          .map(([, value]) => value);
      };

      const mergedStepMetrics = mergeByKey(stepMetricsDb, stepMetricsFromJson, (item, idx) => {
        const keyValue =
          toNumber(item?.step_index ?? item?.stepIndex ?? item?.index ?? idx) ?? idx;
        return keyValue.toString();
      });

      const mergedThreePhaseAngles = mergeByKey(
        threePhaseAnglesDb,
        threePhaseAnglesFromJson,
        (item, idx) => {
          const stepKey =
            toNumber(item?.step_index ?? item?.stepIndex ?? item?.step ?? 0) ?? 0;
          const phaseKey = (item?.phase ?? item?.phase_name ?? item?.phaseName ?? idx).toString().toLowerCase();
          return `${stepKey}-${phaseKey}`;
        }
      );

      const mergedStepSummaryCandidate = {
        ...(stepSummaryFromJson ?? {}),
        ...(stepSummaryDb ?? {}),
      };
      const mergedStepSummary =
        Object.keys(mergedStepSummaryCandidate).length > 0
          ? mergedStepSummaryCandidate
          : null;

      const phaseSnapshots = buildPhaseSnapshots(analysisData, sessionMetadata);

      const sessionView = {
        id: session.id,
        created_at: session.created_at,
        source_video_name: session.source_video_name || session.video_filename,
        distance_m: session.distance_m,
        section_time_s: session.section_time_s,
        avg_speed_mps: session.avg_speed_mps,
        avg_stride_m: session.avg_stride_m,
        avg_cadence_hz: session.avg_cadence_hz,
        avg_contact_time_s: session.avg_contact_time_s,
        avg_flight_time_s: session.avg_flight_time_s,
        frame_count: session.frame_count,
        frames_count: session.frames_count,
        target_fps: session.target_fps,
        source_video_duration_s: session.source_video_duration_s,
        section_start_type: session.section_start_type,
        section_end_type: session.section_end_type,
        section_start_frame: session.section_start_frame,
        section_end_frame: session.section_end_frame,
        notes: session.notes,
        label: session.label,
        stepMetrics: mergedStepMetrics,
        threePhaseAngles: mergedThreePhaseAngles,
        stepSummary: mergedStepSummary,
        session_data: analysisData,
        metadata: sessionMetadata,
        phaseSnapshots,
        _raw: session,
      };

      localStorage.setItem("viewSessionData", JSON.stringify(sessionView));
      localStorage.setItem("viewSessionId", session.id);

      setDetailData({
        session,
        analysisData,
        metadata: sessionMetadata,
        stepMetrics: mergedStepMetrics,
        threePhaseAngles: mergedThreePhaseAngles,
        stepSummary: mergedStepSummary,
        phaseSnapshots,
        sessionView,
      });
    } catch (error: any) {
      console.error("Failed to load session details:", error);
      setDetailError(
        error?.message ?? "セッション詳細の取得中にエラーが発生しました。"
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetailModal = () => {
    setDetailOpen(false);
  };


=======

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

    const renderMultilineText = (text: string) => {
      if (!text) return '';
      const normalized = escapeHtml(text).replace(/\r\n/g, '\n');
      const paragraphs = normalized
        .split(/\n{2,}/)
        .map((paragraph) => {
          const withBullets = paragraph.replace(/^- /gm, '• ');
          return `<p>${withBullets.replace(/\n/g, '<br>')}</p>`;
        })
        .join('');
      return `<div class="markdown">${paragraphs}</div>`;
    };

    const renderScoreTag = (score?: string) => {
      if (!score) return '';
      const normalized = score.toLowerCase();
      const className = ['excellent', 'good', 'fair', 'poor'].includes(normalized)
        ? normalized
        : 'unknown';
      return `<span class="ai-score-tag ${className}">${escapeHtml(score)}</span>`;
    };

    const aiEvaluationData = analysisData?.aiEvaluation;
    const aiEvaluationSection = `
    <div class="section">
      <h2>🤖 AI評価</h2>
      ${
        aiEvaluationData
          ? `
      <div class="ai-overall">
        ${
          aiEvaluationData.overallRating
            ? `<div class="ai-rating-badge">${escapeHtml(aiEvaluationData.overallRating)}</div>`
            : ''
        }
        ${
          aiEvaluationData.avgScore !== undefined && aiEvaluationData.avgScore !== null
            ? `<div class="ai-score">スコア: ${escapeHtml(formatForDisplay(aiEvaluationData.avgScore))}</div>`
            : ''
        }
        ${
          aiEvaluationData.overallMessage
            ? `<p class="ai-overall-message">${escapeHtml(aiEvaluationData.overallMessage)}</p>`
            : ''
        }
      </div>
      ${
        Array.isArray(aiEvaluationData.evaluations) && aiEvaluationData.evaluations.length
          ? `
      <div class="ai-evaluation-grid">
        ${aiEvaluationData.evaluations
          .map((item: any) => `
        <div class="ai-evaluation-card">
          <div class="ai-evaluation-header">
            ${item.icon ? `<span class="ai-icon">${escapeHtml(item.icon)}</span>` : ''}
            <span class="ai-category">${escapeHtml(item.category ?? '')}</span>
            ${renderScoreTag(item.score)}
          </div>
          ${item.message ? `<p class="ai-message">${escapeHtml(item.message)}</p>` : ''}
          ${item.advice ? `<p class="ai-advice">${escapeHtml(item.advice)}</p>` : ''}
        </div>
        `)
          .join('')}
      </div>
      `
          : ''
      }
      `
          : `<p class="empty-message">AI評価データは保存されていません。解析時にスケルトン表示とマーカー設定が完了しているかご確認ください。</p>`
      }
    </div>
    `;

    const targetAdviceText =
      typeof analysisData?.targetAdvice === 'string' ? analysisData.targetAdvice : null;
    const targetAdviceSection = `
    <div class="section">
      <h2>🎯 100m目標記録アドバイス</h2>
      ${
        targetAdviceText && targetAdviceText.trim()
          ? renderMultilineText(targetAdviceText)
          : '<p class="empty-message">100m目標記録に基づくアドバイスは保存されていません。解析時に選手情報の目標記録を設定すると生成されます。</p>'
      }
    </div>
    `;

    const analysisMetaItems: { label: string; value: string }[] = [];
    if (analysisData?.analysisType) {
      const label =
        analysisData.analysisType === 'acceleration'
          ? '加速局面（スタート）'
          : analysisData.analysisType === 'topSpeed'
          ? 'トップスピード局面'
          : String(analysisData.analysisType);
      analysisMetaItems.push({ label: '解析モード', value: label });
    }
    if (sessionMetadata?.analysis_type && !analysisMetaItems.find((i) => i.label === '解析モード')) {
      analysisMetaItems.push({
        label: '解析モード',
        value: String(sessionMetadata.analysis_type),
      });
    }
    if (analysisData?.timestamp) {
      analysisMetaItems.push({
        label: '保存時刻',
        value: new Date(analysisData.timestamp).toLocaleString('ja-JP'),
      });
    }
    if (typeof analysisData?.avgSpeed === 'number') {
      analysisMetaItems.push({
        label: '保存時の平均速度',
        value: `${analysisData.avgSpeed.toFixed(2)} m/s`,
      });
    } else if (analysisData?.avgSpeed) {
      analysisMetaItems.push({
        label: '保存時の平均速度',
        value: `${analysisData.avgSpeed} m/s`,
      });
    }
    if (analysisData?.distance !== undefined && analysisData?.distance !== null) {
      analysisMetaItems.push({ label: '解析距離', value: `${analysisData.distance} m` });
    }
    if (analysisData?.sectionTime !== undefined && analysisData?.sectionTime !== null) {
      analysisMetaItems.push({ label: '区間時間', value: `${analysisData.sectionTime} 秒` });
    }
    if (analysisData?.sectionRange) {
      const range = analysisData.sectionRange;
      if (range.start !== undefined && range.start !== null) {
        analysisMetaItems.push({ label: '開始フレーム', value: `${range.start}` });
      }
      if (range.mid !== undefined && range.mid !== null) {
        analysisMetaItems.push({ label: '中間フレーム', value: `${range.mid}` });
      }
      if (range.end !== undefined && range.end !== null) {
        analysisMetaItems.push({ label: '終了フレーム', value: `${range.end}` });
      }
      if (range.count !== undefined && range.count !== null) {
        analysisMetaItems.push({ label: '抽出フレーム数', value: `${range.count}` });
      }
    }
    if (session.section_start_frame !== undefined && session.section_start_frame !== null) {
      analysisMetaItems.push({
        label: '保存済み開始フレーム',
        value: `${session.section_start_frame}`,
      });
    }
    if (session.section_end_frame !== undefined && session.section_end_frame !== null) {
      analysisMetaItems.push({
        label: '保存済み終了フレーム',
        value: `${session.section_end_frame}`,
      });
    }
    if (analysisData?.framesCount !== undefined && analysisData.framesCount !== null) {
      analysisMetaItems.push({
        label: '抽出フレーム総数',
        value: `${analysisData.framesCount}`,
      });
    }
    if (analysisData?.usedTargetFps !== undefined && analysisData.usedTargetFps !== null) {
      analysisMetaItems.push({
        label: '解析時ターゲットFPS',
        value: `${analysisData.usedTargetFps} fps`,
      });
    }
    if (session.section_frame_count !== undefined && session.section_frame_count !== null) {
      analysisMetaItems.push({
        label: 'セクションフレーム数',
        value: `${session.section_frame_count}`,
      });
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
      ? Object.entries(analysisData.athleteInfo).filter(
          ([, value]) => value !== null && value !== undefined && value !== ''
        )
      : [];
    if (
      session.athlete_name &&
      !athleteInfoEntries.find(
        ([key]) => key === 'name' || key === 'full_name' || key === 'athlete_name'
      )
    ) {
      athleteInfoEntries.unshift(['登録選手名', session.athlete_name]);
    }
    if (
      session.athlete_id &&
      !athleteInfoEntries.find(([key]) => key === 'athlete_id' || key === 'athleteId')
    ) {
      athleteInfoEntries.push(['Athlete ID', session.athlete_id]);
    }

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
      ? Object.entries(sessionMetadata).filter(
          ([, value]) => value !== null && value !== undefined && value !== ''
        )
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

    const storedStepMetrics = Array.isArray(analysisData?.stepMetrics)
      ? analysisData.stepMetrics
      : null;

    const detailedStepMetricsSection =
      storedStepMetrics && storedStepMetrics.length
        ? (() => {
            const keySet = storedStepMetrics.reduce((set: Set<string>, metric: any) => {
              Object.entries(metric).forEach(([key, value]) => {
                if (value === null || value === undefined) return;
                if (typeof value === 'object') return;
                set.add(key);
              });
              return set;
            }, new Set<string>());
            const columns: string[] = Array.from(keySet);
            if (!columns.length) {
              return '';
            }
            const limitedColumns = columns.slice(0, 12);
            const headerCells = limitedColumns
              .map(
                (key) =>
                  `<th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">${escapeHtml(
                    key
                  )}</th>`
              )
              .join('');
            const bodyRows = storedStepMetrics
              .map(
                (metric: any, idx: number) => `
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">#${idx + 1}</td>
            ${limitedColumns
              .map((key) => {
                const display = formatForDisplay(metric[key]);
                return `<td style="padding: 8px; border: 1px solid #e2e8f0;">${
                  display || '-'
                }</td>`;
              })
              .join('')}
          </tr>
          `
              )
              .join('');
            const moreNote = columns.length > limitedColumns.length
              ? `<p class="section-note">※ 全${columns.length}項目のうち、代表的な12項目のみ表示しています。完全なデータは下部のJSON表示をご確認ください。</p>`
              : '';
            return `
    <div class="section">
      <h2>🧾 保存済みステップメトリクス（詳細）</h2>
      ${moreNote}
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f7fafc;">
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">ステップ</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    </div>
    `;
          })()
        : '';

    const rawAnalysisSection = analysisData
      ? `
    <div class="section">
      <h2>🗄️ 保存済み解析データ (JSON)</h2>
      <details>
        <summary>クリックして展開</summary>
        <pre class="json-view">${escapeHtml(JSON.stringify(analysisData, null, 2))}</pre>
      </details>
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
    .empty-message {
      background: #f8fafc;
      border: 1px dashed #cbd5f5;
      border-radius: 12px;
      padding: 16px;
      color: #475569;
      line-height: 1.6;
    }
    .markdown p {
      margin: 0 0 12px;
      line-height: 1.7;
      color: #1f2937;
    }
    .markdown p:last-child {
      margin-bottom: 0;
    }
    .markdown strong {
      color: #1d4ed8;
    }
    .ai-overall {
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ai-rating-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #4338ca;
      color: #fff;
      font-weight: 600;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 0.85rem;
      width: fit-content;
    }
    .ai-score {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1d4ed8;
    }
    .ai-overall-message {
      margin: 0;
      color: #1e293b;
      line-height: 1.6;
    }
    .ai-evaluation-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    .ai-evaluation-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ai-evaluation-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #1e293b;
    }
    .ai-icon {
      font-size: 1.2rem;
    }
    .ai-category {
      flex: 1;
    }
    .ai-score-tag {
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 600;
    }
    .ai-score-tag.excellent {
      background: #dcfce7;
      color: #166534;
    }
    .ai-score-tag.good {
      background: #e0f2fe;
      color: #075985;
    }
    .ai-score-tag.fair {
      background: #fef3c7;
      color: #92400e;
    }
    .ai-score-tag.poor {
      background: #fee2e2;
      color: #b91c1c;
    }
    .ai-score-tag.unknown {
      background: #e2e8f0;
      color: #475569;
    }
    .ai-message {
      margin: 0;
      font-size: 0.9rem;
      color: #334155;
      line-height: 1.5;
    }
    .ai-advice {
      margin: 0;
      font-size: 0.85rem;
      color: #0f172a;
      line-height: 1.5;
    }
    .section-note {
      margin-top: 0;
      margin-bottom: 12px;
      color: #64748b;
      font-size: 0.9rem;
    }
    details {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }
    details summary {
      cursor: pointer;
      font-weight: 600;
      color: #1f2937;
      outline: none;
    }
    details[open] summary {
      margin-bottom: 12px;
    }
    .json-view {
      margin-top: 12px;
      max-height: 320px;
      overflow: auto;
      background: #0f172a;
      color: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      font-size: 0.85rem;
      line-height: 1.4;
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
    ${detailedStepMetricsSection}
    ${metadataSection}
    ${rawAnalysisSection}
    
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

>>>>>>> origin/genspark_ai_developer
  // ラベル編集
  const handleEditSession = (session: RunningAnalysisSession) => {
    const newLabel = prompt('ラベルを編集:', session.label || '');
    if (newLabel !== null) {
      updateSessionLabel(session.id, newLabel);
    }
  };

  // ラベルの更新
  const updateSessionLabel = async (sessionId: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    const { error } = await supabase
      .from('running_analysis_sessions')
      .update({ label: trimmed.length ? trimmed : null })
      .eq('id', sessionId);
    
    if (error) {
      alert('更新に失敗しました: ' + error.message);
    } else {
      setSessions((prev) =>
        prev.map((item) =>
          item.id === sessionId ? { ...item, label: trimmed.length ? trimmed : null } : item
        )
      );
      alert('ラベルを更新しました。');
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
      <SessionDetailModal
        open={detailOpen}
        data={detailData}
        loading={detailLoading}
        error={detailError}
        activeTab={detailTab}
        onTabChange={setDetailTab}
        onClose={handleCloseDetailModal}
      />
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


const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(15, 23, 42, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 2000,
};

const modalContainerStyle: React.CSSProperties = {
  width: "min(1100px, 100%)",
  maxHeight: "90vh",
  backgroundColor: "#ffffff",
  borderRadius: 16,
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const modalHeaderStyle: React.CSSProperties = {
  padding: "20px 24px",
  backgroundColor: "#ffffff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
};

const modalTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
  color: "#0f172a",
};

const modalSubTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 12,
};

const closeButtonStyle: React.CSSProperties = {
  border: "none",
  background: "rgba(15, 23, 42, 0.08)",
  color: "#0f172a",
  borderRadius: 999,
  width: 32,
  height: 32,
  fontSize: 18,
  lineHeight: "32px",
  cursor: "pointer",
};

const tabListStyle: React.CSSProperties = {
  padding: "12px 24px",
  borderBottom: "1px solid #e2e8f0",
  display: "flex",
  gap: 8,
  overflowX: "auto",
  background: "#ffffff",
};

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  border: "none",
  background: active ? "#3b82f6" : "#f8fafc",
  color: active ? "#ffffff" : "#64748b",
  padding: "8px 16px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
});

const tabBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 20,
  height: 20,
  padding: "0 6px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.9)",
  color: "#3b82f6",
  fontSize: 11,
  fontWeight: 700,
};

const modalBodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "24px",
  background: "#f8fafc",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#0f172a",
  marginBottom: 8,
};

const sectionDescriptionStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  margin: "0 0 12px",
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const metricCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  boxShadow: "0 8px 16px rgba(15, 23, 42, 0.05)",
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginBottom: 4,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#0f172a",
};

const metricHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  marginTop: 4,
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: "#e0f2fe",
  color: "#0369a1",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
};

const tableWrapperStyle: React.CSSProperties = {
  overflowX: "auto",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

const tableHeaderCellStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  background: "#eef2ff",
  borderBottom: "1px solid #e2e8f0",
  fontWeight: 600,
  color: "#1e293b",
  whiteSpace: "nowrap",
};

const tableCellStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  whiteSpace: "nowrap",
};

const emptyStateBoxStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 12,
  border: "1px dashed #cbd5f5",
  background: "#f8fafc",
  color: "#475569",
  fontSize: 13,
  textAlign: "center",
};

const imageGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 16,
};

const imageCardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  overflow: "hidden",
  background: "#ffffff",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
  display: "flex",
  flexDirection: "column",
};

const snapshotImgStyle: React.CSSProperties = {
  width: "100%",
  objectFit: "cover",
  aspectRatio: "4 / 3",
};

const snapshotLabelStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#1f2937",
  borderTop: "1px solid #e2e8f0",
  background: "#f8fafc",
};

const noteBoxStyle: React.CSSProperties = {
  background: "#fef3c7",
  border: "1px solid #fcd34d",
  color: "#92400e",
  padding: 16,
  borderRadius: 12,
  fontSize: 13,
  lineHeight: 1.6,
};

const phaseCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const phaseHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  color: "#0f172a",
};

const phaseMetricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
};

const phaseMetricLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
};

const phaseMetricValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "#0f172a",
};

const codeBlockStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "#f8fafc",
  padding: 16,
  borderRadius: 12,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: 12,
  lineHeight: 1.5,
  overflowX: "auto",
  maxHeight: 360,
};

type DetailSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const DetailSection: React.FC<DetailSectionProps> = ({ title, description, children }) => (
  <section style={sectionStyle}>
    <h3 style={sectionTitleStyle}>{title}</h3>
    {description ? <p style={sectionDescriptionStyle}>{description}</p> : null}
    {children}
  </section>
);

type MetricGridItem = {
  label: string;
  value: string;
  hint?: string;
  badge?: string;
};

const MetricGrid: React.FC<{ items: MetricGridItem[] }> = ({ items }) => {
  if (!items.length) {
    return null;
  }
  return (
    <div style={metricGridStyle}>
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} style={metricCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={metricLabelStyle}>{item.label}</span>
            {item.badge ? <span style={chipStyle}>{item.badge}</span> : null}
          </div>
          <div style={metricValueStyle}>{item.value}</div>
          {item.hint ? <div style={metricHintStyle}>{item.hint}</div> : null}
        </div>
      ))}
    </div>
  );
};

const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  open,
  data,
  loading,
  error,
  activeTab,
  onTabChange,
  onClose,
}) => {
  const normalizedPhaseAngles = useMemo(
    () => (data ? normalizePhaseAngles(data.threePhaseAngles ?? []) : []),
    [data]
  );

  if (!open) {
    return null;
  }

  const handleTabClick = (tab: DetailTab) => {
    if (tab !== activeTab) {
      onTabChange(tab);
    }
  };

  const renderContent = () => {
    if (loading) {
      return <div style={emptyStateBoxStyle}>データを読み込んでいます…</div>;
    }

    if (error) {
      return (
        <div
          style={{
            ...emptyStateBoxStyle,
            background: "#fef2f2",
            borderColor: "#fecaca",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      );
    }

    if (!data) {
      return <div style={emptyStateBoxStyle}>このセッションの詳細データを取得できませんでした。</div>;
    }

    switch (activeTab) {
      case "overview":
        return <OverviewTabContent data={data} />;
      case "stepMetrics":
        return <StepMetricsTabContent data={data} />;
      case "step9":
        return <StepNineTabContent data={data} normalizedAngles={normalizedPhaseAngles} />;
      case "aiAdvice":
        return <AiAdviceTabContent data={data} />;
      case "raw":
        return <RawDataTabContent data={data} />;
      default:
        return null;
    }
  };

  const sessionTitle =
    data?.session.source_video_name ?? data?.session.video_filename ?? "解析セッション";

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContainerStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={modalTitleStyle}>解析結果詳細</h2>
            <p style={modalSubTitleStyle}>
              {sessionTitle}（
              {data?.session.created_at
                ? new Date(data.session.created_at).toLocaleString("ja-JP")
                : "日時不明"}
              ）
            </p>
          </div>
          <button type="button" style={closeButtonStyle} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div style={tabListStyle}>
          {DETAIL_TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              style={tabButtonStyle(tab.key === activeTab)}
              onClick={() => handleTabClick(tab.key)}
            >
              {tab.label}
              {tab.key === "step9" && normalizedPhaseAngles.length ? (
                <span style={tabBadgeStyle}>{normalizedPhaseAngles.length}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div style={modalBodyStyle}>{renderContent()}</div>
      </div>
    </div>
  );
};

const OverviewTabContent: React.FC<{ data: SessionDetailData }> = ({ data }) => {
  const { session, stepSummary, metadata, analysisData } = data;

  const baseInfoItems: MetricGridItem[] = [
    { label: "セッションID", value: `${session.id.slice(0, 8)}…` },
    { label: "解析日時", value: new Date(session.created_at).toLocaleString("ja-JP") },
    {
      label: "動画名",
      value: session.source_video_name ?? session.video_filename ?? "ー",
    },
    { label: "ラベル", value: session.label ?? "ー" },
  ];

  const runningItems: MetricGridItem[] = [
    { label: "距離", value: formatMeters(toNumber(session.distance_m), 2) },
    {
      label: "区間時間",
      value:
        session.section_time_s !== null && session.section_time_s !== undefined
          ? `${Number(session.section_time_s).toFixed(3)} s`
          : "ー",
    },
    { label: "平均速度", value: formatSpeed(toNumber(session.avg_speed_mps)) },
    { label: "平均ストライド", value: formatMeters(toNumber(session.avg_stride_m), 2) },
    { label: "平均ピッチ", value: formatStepsPerSecond(toNumber(session.avg_cadence_hz)) },
    { label: "平均接地時間", value: formatSeconds(toNumber(session.avg_contact_time_s ?? null)) },
    { label: "平均滞空時間", value: formatSeconds(toNumber(session.avg_flight_time_s ?? null)) },
  ];

  const summaryItems: MetricGridItem[] = [];
  const stepCount = toNumber(stepSummary?.stepCount ?? stepSummary?.total_steps);
  if (stepCount !== null) {
    summaryItems.push({ label: "ステップ数", value: `${stepCount}` });
  }
  const avgStride = toNumber(
    stepSummary?.avgStride ?? stepSummary?.avg_stride ?? stepSummary?.avg_stride_length
  );
  if (avgStride !== null) {
    summaryItems.push({ label: "平均ストライド", value: formatMeters(avgStride, 2) });
  }
  const avgPitch = toNumber(
    stepSummary?.avgStepPitch ??
      stepSummary?.avg_step_pitch ??
      stepSummary?.avg_cadence
  );
  if (avgPitch !== null) {
    summaryItems.push({ label: "平均ピッチ", value: formatStepsPerSecond(avgPitch) });
  }
  const avgContact = toNumber(
    stepSummary?.avgContact ??
      stepSummary?.avg_contact ??
      (stepSummary?.avg_contact_time !== undefined ? stepSummary?.avg_contact_time : null)
  );
  if (avgContact !== null) {
    summaryItems.push({ label: "平均接地時間", value: formatSeconds(avgContact) });
  }
  const avgFlight = toNumber(
    stepSummary?.avgFlight ??
      stepSummary?.avg_flight ??
      (stepSummary?.avg_flight_time !== undefined ? stepSummary?.avg_flight_time : null)
  );
  if (avgFlight !== null) {
    summaryItems.push({ label: "平均滞空時間", value: formatSeconds(avgFlight) });
  }
  const sectionSpeed = toNumber(
    stepSummary?.sectionSpeed ??
      stepSummary?.section_speed ??
      stepSummary?.avgSpeed ??
      stepSummary?.avg_speed ??
      analysisData?.avgSpeed ??
      session.avg_speed_mps
  );
  if (sectionSpeed !== null) {
    summaryItems.push({ label: "区間平均速度", value: formatSpeed(sectionSpeed) });
  }

  const metadataEntries = useMemo(() => {
    if (!metadata) return [] as MetricGridItem[];
    return Object.entries(metadata)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => ({
        label: key,
        value: formatDisplayValue(value),
      }));
  }, [metadata]);

  const analysisMetaEntries = useMemo(() => {
    const items: MetricGridItem[] = [];
    if (analysisData?.analysisType) {
      const label =
        analysisData.analysisType === "acceleration"
          ? "加速局面（スタート）"
          : analysisData.analysisType === "topSpeed"
          ? "トップスピード局面"
          : String(analysisData.analysisType);
      items.push({ label: "解析モード", value: label });
    }
    if (analysisData?.timestamp) {
      items.push({
        label: "保存時刻",
        value: new Date(analysisData.timestamp).toLocaleString("ja-JP"),
      });
    }
    const distance = toNumber(analysisData?.distance);
    if (distance !== null) {
      items.push({ label: "解析距離", value: `${distance.toFixed(2)} m` });
    }
    const sectionTime = toNumber(analysisData?.sectionTime);
    if (sectionTime !== null) {
      items.push({ label: "区間時間", value: `${sectionTime.toFixed(3)} s` });
    }
    if (analysisData?.sectionRange) {
      const range = analysisData.sectionRange;
      if (range.start !== undefined && range.start !== null) {
        items.push({ label: "開始フレーム", value: `${range.start}` });
      }
      if (range.mid !== undefined && range.mid !== null) {
        items.push({ label: "中間フレーム", value: `${range.mid}` });
      }
      if (range.end !== undefined && range.end !== null) {
        items.push({ label: "終了フレーム", value: `${range.end}` });
      }
    }
    return items;
  }, [analysisData]);

  const athleteInfoEntries = useMemo(() => {
    const entries: MetricGridItem[] = [];
    const athleteInfo = (analysisData?.athleteInfo ?? {}) as Record<string, any>;
    Object.entries(athleteInfo).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        entries.push({ label: key, value: formatDisplayValue(value) });
      }
    });
    if (session.athlete_name && !entries.find((item) => item.label === "登録選手名")) {
      entries.unshift({ label: "登録選手名", value: session.athlete_name });
    }
    if (session.athlete_id && !entries.find((item) => item.label === "Athlete ID")) {
      entries.push({ label: "Athlete ID", value: session.athlete_id });
    }
    return entries;
  }, [analysisData?.athleteInfo, session.athlete_id, session.athlete_name]);

  return (
    <>
      <DetailSection title="基本情報">
        <MetricGrid items={baseInfoItems} />
      </DetailSection>

      <DetailSection title="走行サマリー">
        <MetricGrid items={runningItems} />
      </DetailSection>

      {summaryItems.length ? (
        <DetailSection title="ステップ指標概要" description="保存済みステップサマリーの主要値です。">
          <MetricGrid items={summaryItems} />
        </DetailSection>
      ) : null}

      {analysisMetaEntries.length ? (
        <DetailSection title="解析メタ情報">
          <MetricGrid items={analysisMetaEntries} />
        </DetailSection>
      ) : null}

      {metadataEntries.length ? (
        <DetailSection title="メタデータ">
          <div style={metricGridStyle}>
            {metadataEntries.map((item) => (
              <div key={item.label} style={metricCardStyle}>
                <div style={metricLabelStyle}>{item.label}</div>
                <div style={{ ...metricValueStyle, fontSize: 14 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </DetailSection>
      ) : null}

      {athleteInfoEntries.length ? (
        <DetailSection title="選手情報">
          <MetricGrid items={athleteInfoEntries} />
        </DetailSection>
      ) : null}

      {session.notes ? (
        <DetailSection title="メモ">
          <div style={noteBoxStyle}>{renderMultiline(session.notes)}</div>
        </DetailSection>
      ) : null}
    </>
  );
};

const StepMetricsTabContent: React.FC<{ data: SessionDetailData }> = ({ data }) => {
  const stepMetricsArray = Array.isArray(data.stepMetrics) ? data.stepMetrics : [];
  const analysisData = data.analysisData ?? {};
  const stepSummary = data.stepSummary ?? {};
  const session = data.session;

  const midFrame = toNumber(
    analysisData?.sectionRange?.mid ??
      (session as any)?.section_mid_frame ??
      stepSummary?.midFrame ??
      stepSummary?.mid_frame ??
      null
  );

  const getContactFrame = (metric: any) =>
    getMetricNumber(metric, [
      "contactFrame",
      "contact_frame",
      "contact_frame_index",
      "frameIndex",
      "frame",
    ]);

  const computeAverage = (items: any[], keys: string[]) => {
    const values = items
      .map((metric) => getMetricNumber(metric, keys))
      .filter((value): value is number => value !== null);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const splitMetrics = () => {
    if (!stepMetricsArray.length) {
      return { front: [] as any[], back: [] as any[] };
    }
    if (midFrame !== null) {
      const front = stepMetricsArray.filter((metric) => {
        const contact = getContactFrame(metric);
        return contact !== null ? contact < midFrame : false;
      });
      const back = stepMetricsArray.filter((metric) => {
        const contact = getContactFrame(metric);
        return contact !== null ? contact >= midFrame : false;
      });
      const fallbackSplit = Math.ceil(stepMetricsArray.length / 2);
      return {
        front: front.length ? front : stepMetricsArray.slice(0, fallbackSplit),
        back: back.length ? back : stepMetricsArray.slice(fallbackSplit),
      };
    }
    const splitIndex = Math.ceil(stepMetricsArray.length / 2);
    return {
      front: stepMetricsArray.slice(0, splitIndex),
      back: stepMetricsArray.slice(splitIndex),
    };
  };

  const { front, back } = splitMetrics();

  const summaryItems: MetricGridItem[] = [
    {
      label: "ステップ数",
      value: `${
        toNumber(stepSummary?.stepCount ?? stepSummary?.total_steps) ?? stepMetricsArray.length
      }`,
    },
    {
      label: "平均接地時間",
      value: formatSeconds(
        toNumber(stepSummary?.avgContact ?? stepSummary?.avg_contact) ??
          computeAverage(stepMetricsArray, ["contactTime", "contact_time"])
      ),
    },
    {
      label: "平均滞空時間",
      value: formatSeconds(
        toNumber(stepSummary?.avgFlight ?? stepSummary?.avg_flight) ??
          computeAverage(stepMetricsArray, ["flightTime", "flight_time"])
      ),
    },
    {
      label: "平均ピッチ",
      value: formatStepsPerSecond(
        toNumber(
          stepSummary?.avgStepPitch ??
            stepSummary?.avg_step_pitch ??
            stepSummary?.avg_cadence
        ) ?? computeAverage(stepMetricsArray, ["stepPitch", "pitch", "cadence"])
      ),
    },
    {
      label: "平均ストライド",
      value: formatMeters(
        toNumber(
          stepSummary?.avgStride ??
            stepSummary?.avg_stride ??
            stepSummary?.avg_stride_length
        ) ?? computeAverage(stepMetricsArray, ["fullStride", "stride", "stride_length"]),
        2
      ),
    },
    {
      label: "平均速度",
      value: formatSpeed(
        toNumber(
          stepSummary?.avgSpeedMps ??
            stepSummary?.avg_speed ??
            stepSummary?.avg_speed_mps
        ) ?? computeAverage(stepMetricsArray, ["speedMps", "speed_mps", "speed"])
      ),
    },
  ];

  const comparisonItems: MetricGridItem[] = [];
  if (front.length && back.length) {
    const compareConfigs = [
      {
        key: "接地時間",
        frontValue: computeAverage(front, ["contactTime", "contact_time"]),
        backValue: computeAverage(back, ["contactTime", "contact_time"]),
        formatter: (v: number | null) => formatSeconds(v),
      },
      {
        key: "滞空時間",
        frontValue: computeAverage(front, ["flightTime", "flight_time"]),
        backValue: computeAverage(back, ["flightTime", "flight_time"]),
        formatter: (v: number | null) => formatSeconds(v),
      },
      {
        key: "ピッチ",
        frontValue: computeAverage(front, ["stepPitch", "pitch", "cadence"]),
        backValue: computeAverage(back, ["stepPitch", "pitch", "cadence"]),
        formatter: (v: number | null) => formatStepsPerSecond(v),
      },
      {
        key: "ストライド",
        frontValue: computeAverage(front, ["fullStride", "stride", "stride_length"]),
        backValue: computeAverage(back, ["fullStride", "stride", "stride_length"]),
        formatter: (v: number | null) => formatMeters(v, 2),
      },
      {
        key: "速度",
        frontValue: computeAverage(front, ["speedMps", "speed_mps", "speed"]),
        backValue: computeAverage(back, ["speedMps", "speed_mps", "speed"]),
        formatter: (v: number | null) => formatSpeed(v),
      },
      {
        key: "加速度",
        frontValue: computeAverage(front, ["acceleration", "accel"]),
        backValue: computeAverage(back, ["acceleration", "accel"]),
        formatter: (v: number | null) => formatAcceleration(v),
      },
    ];

    compareConfigs.forEach(({ key, frontValue, backValue, formatter }) => {
      if (frontValue !== null || backValue !== null) {
        const diff = frontValue !== null && backValue !== null ? backValue - frontValue : null;
        comparisonItems.push({
          label: key,
          value: `${formatter(frontValue)} → ${formatter(backValue)}`,
          hint: diff !== null ? `変化量: ${diff > 0 ? "+" : ""}${diff.toFixed(3)}` : undefined,
        });
      }
    });
  }

  const sectionDistance = toNumber(session.distance_m ?? analysisData?.distance);
  const sectionTime = toNumber(
    stepSummary?.sectionTime ??
      stepSummary?.section_time ??
      analysisData?.sectionTime ??
      session.section_time_s
  );
  const highlightItems: MetricGridItem[] = [];
  if (sectionDistance !== null) {
    highlightItems.push({
      label: "解析距離 (腰基準)",
      value: `${sectionDistance.toFixed(2)} m`,
    });
  }
  if (sectionTime !== null) {
    highlightItems.push({
      label: "トルソー通過タイム",
      value: `${sectionTime.toFixed(3)} s`,
    });
  }

  return (
    <>
      <DetailSection title="ステップ統計のサマリー" description="保存済みデータから復元したステップ指標の平均値です。">
        <MetricGrid items={summaryItems} />
      </DetailSection>

      {comparisonItems.length ? (
        <DetailSection title="前半 / 後半比較" description="接地区間の中間フレームを境に前後半を比較しています。">
          <MetricGrid items={comparisonItems} />
        </DetailSection>
      ) : null}

      {highlightItems.length ? (
        <DetailSection title="区間ハイライト">
          <MetricGrid items={highlightItems} />
        </DetailSection>
      ) : null}

      <DetailSection title="各ステップ詳細" description="Step 9 の指標を表形式で確認できます。">
        {stepMetricsArray.length ? (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={tableHeaderCellStyle}>#</th>
                  <th style={tableHeaderCellStyle}>接地F</th>
                  <th style={tableHeaderCellStyle}>離地F</th>
                  <th style={tableHeaderCellStyle}>接地時間</th>
                  <th style={tableHeaderCellStyle}>滞空時間</th>
                  <th style={tableHeaderCellStyle}>ピッチ</th>
                  <th style={tableHeaderCellStyle}>ストライド</th>
                  <th style={tableHeaderCellStyle}>速度</th>
                  <th style={tableHeaderCellStyle}>加速度</th>
                  <th style={tableHeaderCellStyle}>減速率 / 推進率</th>
                </tr>
              </thead>
              <tbody>
                {stepMetricsArray.map((metric, index) => {
                  const stepIndex =
                    toNumber(metric?.index ?? metric?.stepIndex ?? metric?.step_index) ??
                    index + 1;
                  const contactFrame = getContactFrame(metric);
                  const toeOffFrame = getMetricNumber(metric, [
                    "toeOffFrame",
                    "toe_off_frame",
                    "toe_frame",
                  ]);
                  const contactTime = getMetricNumber(metric, ["contactTime", "contact_time"]);
                  const flightTime = getMetricNumber(metric, ["flightTime", "flight_time"]);
                  const pitch = getMetricNumber(metric, ["stepPitch", "pitch", "cadence"]);
                  const stride = getMetricNumber(metric, ["fullStride", "stride", "stride_length"]);
                  const speed = getMetricNumber(metric, ["speedMps", "speed_mps", "speed"]);
                  const acceleration = getMetricNumber(metric, ["acceleration", "accel"]);
                  const brake = getMetricNumber(metric, ["brakeImpulseRatio", "brake_impulse_ratio"]);
                  const kick = getMetricNumber(metric, ["kickImpulseRatio", "kick_impulse_ratio"]);

                  return (
                    <tr key={`step-${stepIndex}`}>
                      <td style={tableCellStyle}>{stepIndex}</td>
                      <td style={tableCellStyle}>
                        {contactFrame !== null ? Math.round(contactFrame) : "ー"}
                      </td>
                      <td style={tableCellStyle}>
                        {toeOffFrame !== null ? Math.round(toeOffFrame) : "ー"}
                      </td>
                      <td style={tableCellStyle}>{formatSeconds(contactTime)}</td>
                      <td style={tableCellStyle}>{formatSeconds(flightTime)}</td>
                      <td style={tableCellStyle}>{formatStepsPerSecond(pitch)}</td>
                      <td style={tableCellStyle}>{formatMeters(stride, 2)}</td>
                      <td style={tableCellStyle}>{formatSpeed(speed)}</td>
                      <td style={tableCellStyle}>{formatAcceleration(acceleration)}</td>
                      <td style={tableCellStyle}>
                        {brake !== null && kick !== null
                          ? `${formatPercent(brake)} / ${formatPercent(kick)}`
                          : "ー"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={emptyStateBoxStyle}>ステップメトリクスが保存されていません。</div>
        )}
      </DetailSection>
    </>
  );
};

const StepNineTabContent: React.FC<{ data: SessionDetailData; normalizedAngles: NormalizedPhaseAngle[] }> = ({
  data,
  normalizedAngles,
}) => {
  const snapshots = data.phaseSnapshots ?? [];

  const phaseSummaryRows = useMemo(() => {
    if (!normalizedAngles.length) return [] as Array<{
      phaseKey: string;
      phaseLabel: string;
      stepCount: number;
      trunkAvg: number | null;
      thighLeftAvg: number | null;
      thighRightAvg: number | null;
      leftToeAvg: number | null;
      rightToeAvg: number | null;
      toeDiff: number | null;
      kneeLeftAvg: number | null;
      kneeRightAvg: number | null;
    }>;

    const summaryMap = new Map<
      string,
      {
        phaseKey: string;
        phaseLabel: string;
        trunkValues: number[];
        thighLeftValues: number[];
        thighRightValues: number[];
        leftToeValues: number[];
        rightToeValues: number[];
        kneeLeftValues: number[];
        kneeRightValues: number[];
        stepIndices: Set<number | string>;
      }
    >();

    normalizedAngles.forEach((angle, idx) => {
      const key = angle.phaseKey || `phase-${idx}`;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          phaseKey: key,
          phaseLabel: angle.phaseLabel,
          trunkValues: [],
          thighLeftValues: [],
          thighRightValues: [],
          leftToeValues: [],
          rightToeValues: [],
          kneeLeftValues: [],
          kneeRightValues: [],
          stepIndices: new Set(),
        });
      }

      const summary = summaryMap.get(key)!;
      summary.phaseLabel = angle.phaseLabel;
      summary.stepIndices.add(angle.stepIndex ?? `unknown-${idx}`);
      if (angle.trunkAngle !== null) summary.trunkValues.push(angle.trunkAngle);
      if (angle.thighLeft !== null) summary.thighLeftValues.push(angle.thighLeft);
      if (angle.thighRight !== null) summary.thighRightValues.push(angle.thighRight);
      if (angle.toeDistanceLeft !== null) summary.leftToeValues.push(angle.toeDistanceLeft);
      if (angle.toeDistanceRight !== null) summary.rightToeValues.push(angle.toeDistanceRight);
      if (angle.kneeLeft !== null) summary.kneeLeftValues.push(angle.kneeLeft);
      if (angle.kneeRight !== null) summary.kneeRightValues.push(angle.kneeRight);
    });

    return Array.from(summaryMap.values())
      .map((summary) => {
        const trunkAvg = average(summary.trunkValues);
        const thighLeftAvg = average(summary.thighLeftValues);
        const thighRightAvg = average(summary.thighRightValues);
        const leftToeAvg = average(summary.leftToeValues);
        const rightToeAvg = average(summary.rightToeValues);
        const toeDiff =
          leftToeAvg !== null && rightToeAvg !== null ? rightToeAvg - leftToeAvg : null;
        const kneeLeftAvg = average(summary.kneeLeftValues);
        const kneeRightAvg = average(summary.kneeRightValues);

        return {
          phaseKey: summary.phaseKey,
          phaseLabel: summary.phaseLabel,
          stepCount: summary.stepIndices.size,
          trunkAvg,
          thighLeftAvg,
          thighRightAvg,
          leftToeAvg,
          rightToeAvg,
          toeDiff,
          kneeLeftAvg,
          kneeRightAvg,
        };
      })
      .sort((a, b) => {
        const order = getPhaseOrderIndex(a.phaseKey) - getPhaseOrderIndex(b.phaseKey);
        if (order !== 0) return order;
        return a.phaseLabel.localeCompare(b.phaseLabel, "ja");
      });
  }, [normalizedAngles]);

  const groupedAngles = useMemo(() => {
    if (!normalizedAngles.length) {
      return [] as Array<{ stepIndex: number | null; angles: NormalizedPhaseAngle[] }>;
    }

    const groupingMap = new Map<number | "unknown", NormalizedPhaseAngle[]>();

    normalizedAngles.forEach((angle) => {
      const key = angle.stepIndex !== null ? angle.stepIndex : "unknown";
      const list = groupingMap.get(key) ?? [];
      list.push(angle);
      groupingMap.set(key, list);
    });

    return Array.from(groupingMap.entries())
      .map(([key, angles]) => ({
        stepIndex: key === "unknown" ? null : (key as number),
        angles: angles.sort((a, b) => {
          const phaseOrderDiff = getPhaseOrderIndex(a.phaseKey) - getPhaseOrderIndex(b.phaseKey);
          if (phaseOrderDiff !== 0) return phaseOrderDiff;
          const frameA = a.frame ?? Number.POSITIVE_INFINITY;
          const frameB = b.frame ?? Number.POSITIVE_INFINITY;
          if (frameA !== frameB) return frameA - frameB;
          return a.phaseLabel.localeCompare(b.phaseLabel, "ja");
        }),
      }))
      .sort((a, b) => {
        if (a.stepIndex === null && b.stepIndex === null) return 0;
        if (a.stepIndex === null) return 1;
        if (b.stepIndex === null) return -1;
        return a.stepIndex - b.stepIndex;
      });
  }, [normalizedAngles]);

  const largestToeGap = useMemo(() => {
    if (!phaseSummaryRows.length) return null as
      | { phaseLabel: string; diff: number; diffAbs: number }
      | null;

    return phaseSummaryRows.reduce((acc, row) => {
      const diffAbs = row.toeDiff !== null ? Math.abs(row.toeDiff) : null;
      if (diffAbs === null) return acc;
      if (!acc || diffAbs > acc.diffAbs) {
        return {
          phaseLabel: row.phaseLabel,
          diff: row.toeDiff!,
          diffAbs,
        };
      }
      return acc;
    }, null as { phaseLabel: string; diff: number; diffAbs: number } | null);
  }, [phaseSummaryRows]);

  return (
    <>
      <DetailSection
        title="局面別トロカンター-足先距離"
        description="Step 9（プロ版）で保存されたトロカンター-足先距離と角度データの平均値を局面ごとにまとめています。"
      >
        {phaseSummaryRows.length ? (
          <>
            {largestToeGap ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 12,
                  background: "#ecfeff",
                  border: "1px solid #22d3ee",
                  color: "#0f172a",
                  fontSize: 12,
                }}
              >
                左右差が最大の局面：{largestToeGap.phaseLabel}（
                {largestToeGap.diff > 0 ? "+" : ""}
                {largestToeGap.diff.toFixed(1)}cm）
              </div>
            ) : null}
            <div style={tableWrapperStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={tableHeaderCellStyle}>局面</th>
                    <th style={tableHeaderCellStyle}>対象ステップ数</th>
                    <th style={tableHeaderCellStyle}>体幹角度</th>
                    <th style={tableHeaderCellStyle}>左大腿角度</th>
                    <th style={tableHeaderCellStyle}>右大腿角度</th>
                    <th style={tableHeaderCellStyle}>左トロカンター-足先距離</th>
                    <th style={tableHeaderCellStyle}>右トロカンター-足先距離</th>
                    <th style={tableHeaderCellStyle}>左右差</th>
                    <th style={tableHeaderCellStyle}>左膝角度</th>
                    <th style={tableHeaderCellStyle}>右膝角度</th>
                  </tr>
                </thead>
                <tbody>
                  {phaseSummaryRows.map((row) => (
                    <tr key={`phase-summary-${row.phaseKey}`}>
                      <td style={tableCellStyle}>{row.phaseLabel}</td>
                      <td style={tableCellStyle}>{row.stepCount}</td>
                      <td style={tableCellStyle}>{formatAngle(row.trunkAvg)}</td>
                      <td style={tableCellStyle}>{formatAngle(row.thighLeftAvg)}</td>
                      <td style={tableCellStyle}>{formatAngle(row.thighRightAvg)}</td>
                      <td style={tableCellStyle}>{formatDistanceCm(row.leftToeAvg)}</td>
                      <td style={tableCellStyle}>{formatDistanceCm(row.rightToeAvg)}</td>
                      <td style={{
                        ...tableCellStyle,
                        color:
                          row.toeDiff !== null
                            ? row.toeDiff > 0
                              ? "#16a34a"
                              : row.toeDiff < 0
                              ? "#dc2626"
                              : tableCellStyle.color
                            : tableCellStyle.color,
                      }}>
                        {row.toeDiff !== null ? `${row.toeDiff > 0 ? "+" : ""}${row.toeDiff.toFixed(1)}cm` : "ー"}
                      </td>
                      <td style={tableCellStyle}>{formatAngle(row.kneeLeftAvg)}</td>
                      <td style={tableCellStyle}>{formatAngle(row.kneeRightAvg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={emptyStateBoxStyle}>
            三局面角度データが保存されていません。解析時にスケルトン表示をオンにして保存してください。
          </div>
        )}
      </DetailSection>

      <DetailSection
        title="ステップ別三局面詳細"
        description="各ステップで保存された三局面（接地・垂直・離地など）の指標を確認できます。"
      >
        {groupedAngles.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {groupedAngles.map((group, groupIdx) => (
              <div key={`step-${group.stepIndex ?? `unknown-${groupIdx}`}`} style={phaseCardStyle}>
                <div style={phaseHeaderStyle}>
                  <strong>
                    ステップ {group.stepIndex !== null ? group.stepIndex : "不明"}
                  </strong>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    局面数: {group.angles.length}
                  </span>
                </div>
                <div style={tableWrapperStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={tableHeaderCellStyle}>局面</th>
                        <th style={tableHeaderCellStyle}>フレーム</th>
                        <th style={tableHeaderCellStyle}>体幹角度</th>
                        <th style={tableHeaderCellStyle}>左大腿角度</th>
                        <th style={tableHeaderCellStyle}>右大腿角度</th>
                        <th style={tableHeaderCellStyle}>左トロカンター-足先距離</th>
                        <th style={tableHeaderCellStyle}>右トロカンター-足先距離</th>
                        <th style={tableHeaderCellStyle}>左膝角度</th>
                        <th style={tableHeaderCellStyle}>右膝角度</th>
                        <th style={tableHeaderCellStyle}>左肘角度</th>
                        <th style={tableHeaderCellStyle}>右肘角度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.angles.map((angle, idx) => (
                        <tr key={`${group.stepIndex ?? "unknown"}-${angle.phaseKey}-${angle.frame ?? idx}`}>
                          <td style={tableCellStyle}>{angle.phaseLabel}</td>
                          <td style={tableCellStyle}>{
                            angle.frame !== null && angle.frame !== undefined
                              ? angle.frame
                              : "ー"
                          }</td>
                          <td style={tableCellStyle}>{formatAngle(angle.trunkAngle)}</td>
                          <td style={tableCellStyle}>{formatAngle(angle.thighLeft)}</td>
                          <td style={tableCellStyle}>{formatAngle(angle.thighRight)}</td>
                          <td style={tableCellStyle}>{formatDistanceCm(angle.toeDistanceLeft)}</td>
                          <td style={tableCellStyle}>{formatDistanceCm(angle.toeDistanceRight)}</td>
                          <td style={tableCellStyle}>{formatAngle(angle.kneeLeft)}</td>
                          <td style={tableCellStyle}>{formatAngle(angle.kneeRight)}</td>
                          <td style={tableCellStyle}>{formatAngle(angle.elbowLeft)}</td>
                          <td style={tableCellStyle}>{formatAngle(angle.elbowRight)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={emptyStateBoxStyle}>三局面角度データが保存されていません。</div>
        )}
      </DetailSection>

      <DetailSection title="局面スナップショット" description="保存された各局面の画像を一覧表示します。">
        {snapshots.length ? (
          <div style={imageGridStyle}>
            {snapshots.map((snapshot, idx) => (
              <div key={`snapshot-${idx}`} style={imageCardStyle}>
                {snapshot.image ? (
                  <img
                    src={snapshot.image}
                    alt={`${snapshot.phase ?? "phase"} snapshot`}
                    style={snapshotImgStyle}
                  />
                ) : (
                  <div style={{ ...emptyStateBoxStyle, margin: 0, border: "none", boxShadow: "none" }}>
                    画像データが見つかりません
                  </div>
                )}
                <div style={snapshotLabelStyle}>
                  <strong>{snapshot.phase ?? "局面不明"}</strong>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    ステップ {snapshot.stepIndex ?? "ー"} / フレーム {snapshot.frame ?? "ー"}
                  </div>
                  {snapshot.label ? (
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                      {snapshot.label}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={emptyStateBoxStyle}>局面スナップショットが保存されていません。</div>
        )}
      </DetailSection>
    </>
  );
};

const AiAdviceTabContent: React.FC<{ data: SessionDetailData }> = ({ data }) => {
  const ai = data.analysisData?.aiEvaluation;
  const adviceText =
    typeof data.analysisData?.targetAdvice === "string"
      ? data.analysisData.targetAdvice
      : null;

  return (
    <>
      <DetailSection title="AI評価">
        {ai ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {ai.overallRating ? (
                  <span style={{ ...chipStyle, background: "#4338ca", color: "#ffffff" }}>
                    {ai.overallRating}
                  </span>
                ) : null}
                {ai.avgScore !== undefined && ai.avgScore !== null ? (
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1d4ed8" }}>
                    スコア: {formatDisplayValue(ai.avgScore)}
                  </span>
                ) : null}
              </div>
              {ai.overallMessage ? (
                <p style={{ margin: "12px 0 0", color: "#1e293b", lineHeight: 1.6 }}>
                  {ai.overallMessage}
                </p>
              ) : null}
            </div>
            {Array.isArray(ai.evaluations) && ai.evaluations.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                {ai.evaluations.map((item: any, idx: number) => (
                  <div key={`eval-${idx}`} style={metricCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      {item.icon ? <span style={{ fontSize: 18 }}>{item.icon}</span> : null}
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>
                        {item.category ?? `項目${idx + 1}`}
                      </span>
                    </div>
                    {item.message ? (
                      <p style={{ fontSize: 12, lineHeight: 1.6, color: "#334155", marginBottom: 6 }}>
                        {item.message}
                      </p>
                    ) : null}
                    {item.advice ? (
                      <p style={{ fontSize: 12, lineHeight: 1.6, color: "#0f172a", margin: 0 }}>
                        {item.advice}
                      </p>
                    ) : null}
                    {item.score ? (
                      <div style={{ marginTop: 8 }}>
                        <span style={chipStyle}>{item.score}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={emptyStateBoxStyle}>
            AI評価データは保存されていません。解析時にスケルトン表示とマーカー設定が完了しているか確認してください。
          </div>
        )}
      </DetailSection>

      <DetailSection title="100m目標記録アドバイス">
        {adviceText ? (
          <div style={metricCardStyle}>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: "#1f2937" }}>
              {renderMultiline(adviceText)}
            </div>
          </div>
        ) : (
          <div style={emptyStateBoxStyle}>
            100m目標記録に基づくアドバイスは保存されていません。解析時に選手情報の目標記録を設定すると生成されます。
          </div>
        )}
      </DetailSection>
    </>
  );
};

const RawDataTabContent: React.FC<{ data: SessionDetailData }> = ({ data }) => (
  <>
    <DetailSection title="解析結果 JSON">
      {data.analysisData ? (
        <pre style={codeBlockStyle}>{JSON.stringify(data.analysisData, null, 2)}</pre>
      ) : (
        <div style={emptyStateBoxStyle}>解析データは保存されていません。</div>
      )}
    </DetailSection>

    <DetailSection title="メタデータ JSON">
      {data.metadata ? (
        <pre style={codeBlockStyle}>{JSON.stringify(data.metadata, null, 2)}</pre>
      ) : (
        <div style={emptyStateBoxStyle}>メタデータは保存されていません。</div>
      )}
    </DetailSection>

    <DetailSection title="セッションエンティティ">
      <pre style={codeBlockStyle}>{JSON.stringify(data.session, null, 2)}</pre>
    </DetailSection>
  </>
);

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
