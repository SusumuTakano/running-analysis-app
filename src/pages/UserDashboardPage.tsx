// src/pages/UserDashboardPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type RunningAnalysisSession = {
  id: string;
  created_at: string;
  source_video_name: string | null;
  distance_m: number | null;
  section_time_s: number | null;
  avg_speed_mps: number | null;
  label: string | null;
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

      const { data: sessionsData, error: sessionsError } =
        await supabase
          .from("running_analysis_sessions")
          .select(
            "id, created_at, source_video_name, distance_m, section_time_s, avg_speed_mps, label"
          )
          .order("created_at", { ascending: false })
          .limit(10);

      if (sessionsError) {
        setErrorMsg(sessionsError.message);
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
            今後、「選手と解析のひもづけ」「詳細表示／編集」機能をここに追加していきます。
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
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td style={tdStyle}>
                        {new Date(s.created_at).toLocaleString("ja-JP")}
                      </td>
                      <td style={tdStyle}>{s.source_video_name ?? "-"}</td>
                      <td style={tdStyle}>{s.distance_m ?? "-"}</td>
                      <td style={tdStyle}>{s.section_time_s ?? "-"}</td>
                      <td style={tdStyle}>{s.avg_speed_mps ?? "-"}</td>
                      <td style={tdStyle}>{s.label ?? "-"}</td>
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
