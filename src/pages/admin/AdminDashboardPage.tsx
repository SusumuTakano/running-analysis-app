// src/pages/admin/AdminDashboardPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

/** running_analysis_sessions テーブルの型（使うカラムだけ） */
type RunningAnalysisSession = {
  id: string;
  created_at: string;
  source_video_name: string | null;
  distance_m: number | null;
  section_time_s: number | null;
  avg_speed_mps: number | null;
  label: string | null;
};

const AdminDashboardPage: React.FC = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RunningAnalysisSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const navigate = useNavigate();

  // ログイン確認＆セッション一覧取得
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        navigate("/admin/login", { replace: true });
        return;
      }

      setUserEmail(sessionData.session.user.email ?? null);

      const { data, error } = await supabase
        .from("running_analysis_sessions")
        .select(
          "id, created_at, source_video_name, distance_m, section_time_s, avg_speed_mps, label"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSessions(data ?? []);
      }

      setLoading(false);
    };

    load();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  /** 解析セッションの削除 */
  const handleDeleteSession = async (id: string) => {
    const ok = window.confirm("この解析セッションを削除しますか？\n※元に戻せません。");
    if (!ok) return;

    try {
      setBusyIds((prev) => [...prev, id]);

      const { error } = await supabase
        .from("running_analysis_sessions")
        .delete()
        .eq("id", id);

      if (error) {
        alert("削除に失敗しました: " + error.message);
        return;
      }

      setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusyIds((prev) => prev.filter((x) => x !== id));
    }
  };

  // サマリー用
  const totalSessions = sessions.length;
  const lastSession = sessions[0] ?? null;
  const lastDateText = lastSession
    ? new Date(lastSession.created_at).toLocaleString("ja-JP")
    : "まだ解析がありません";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", padding: 24, color: "#fff" }}>
        読み込み中…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 24, color: "#fff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* ヘッダー */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 4 }}>管理画面トップ</h1>
            <p style={{ fontSize: 13 }}>
              ランニング動作解析システムの管理者用ダッシュボードです。
              <br />
              ログイン中：{userEmail ?? "不明なユーザー"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.6)",
              background: "rgba(0,0,0,0.3)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            ログアウト
          </button>
        </header>

        {/* サマリーカード */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <SummaryCard
            title="総解析セッション数"
            value={`${totalSessions} 件`}
            caption="running_analysis_sessions に保存されている件数"
          />
          <SummaryCard
            title="直近の解析日時"
            value={lastDateText}
            caption="最新のセッション作成日時"
          />
          <SummaryCard
            title="ダッシュボードの使い方"
            value="解析履歴の確認・整理"
            caption="誤解析やテストデータは削除して整理できます"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Link
            to="/admin/users"
            style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.6)",
              fontSize: 12,
              color: "#fff",
            }}
          >
            ユーザー管理へ →
          </Link>
        </div>

        {/* 一覧テーブル */}
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>解析セッション一覧</h2>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            Supabase の <code>running_analysis_sessions</code>{" "}
            テーブルから直近 50 件を表示しています。
          </p>

          {errorMsg && (
            <div
              style={{
                marginBottom: 12,
                padding: 8,
                background: "#ffebee",
                color: "#b00020",
                fontSize: 12,
                borderRadius: 4,
              }}
            >
              {errorMsg}
            </div>
          )}

          {sessions.length === 0 ? (
            <div
              style={{
                marginTop: 12,
                padding: 24,
                borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.6)",
                background: "rgba(0,0,0,0.25)",
                textAlign: "center",
                fontSize: 13,
              }}
            >
              <p style={{ marginBottom: 8 }}>まだ解析セッションは登録されていません。</p>
              <p>
                トップページから動画解析を実行すると、
                <br />
                ここに解析履歴が自動的に追加されます。
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(0,0,0,0.25)",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.35)" }}>
                    <th style={thStyle}>日時</th>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>動画名</th>
                    <th style={thStyle}>距離(m)</th>
                    <th style={thStyle}>区間時間(s)</th>
                    <th style={thStyle}>平均速度(m/s)</th>
                    <th style={thStyle}>ラベル</th>
                    <th style={thStyle}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const isBusy = busyIds.includes(s.id);
                    return (
                      <tr key={s.id}>
                        <td style={tdStyle}>
                          {new Date(s.created_at).toLocaleString("ja-JP")}
                        </td>
                        <td style={tdStyle}>{s.id}</td>
                        <td style={tdStyle}>{s.source_video_name ?? "-"}</td>
                        <td style={tdStyle}>{s.distance_m ?? "-"}</td>
                        <td style={tdStyle}>{s.section_time_s ?? "-"}</td>
                        <td style={tdStyle}>{s.avg_speed_mps ?? "-"}</td>
                        <td style={tdStyle}>{s.label ?? "-"}</td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => handleDeleteSession(s.id)}
                            disabled={isBusy}
                            style={{
                              padding: "4px 10px",
                              fontSize: 11,
                              borderRadius: 999,
                              border: "none",
                              background: isBusy ? "#888" : "#ff4b5c",
                              color: "#fff",
                              cursor: isBusy ? "default" : "pointer",
                            }}
                          >
                            {isBusy ? "削除中…" : "削除"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.25)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{value}</div>
      {caption && (
        <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.4 }}>{caption}</div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.3)",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.15)",
  whiteSpace: "nowrap",
};

export default AdminDashboardPage;
