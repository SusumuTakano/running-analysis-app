// src/pages/admin/AdminUsersPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type AppUser = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  full_name_kana: string;
  email: string;
  birth_date: string;
  postal_code: string;
  prefecture: string;
  occupation: string | null;
  affiliation: string | null;
  created_at: string;
};

const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setUsers(data ?? []);
      }

      setLoading(false);
    };

    load();
  }, [navigate]);

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
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, marginBottom: 4 }}>ユーザー管理</h1>
            <p style={{ fontSize: 13 }}>
              ユーザー登録フォームから登録された利用者の一覧です。
            </p>
          </div>
          <Link
            to="/admin"
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.6)",
              fontSize: 12,
              color: "#fff",
            }}
          >
            ← 管理トップへ戻る
          </Link>
        </header>

        {errorMsg && (
          <div
            style={{
              marginBottom: 12,
              padding: 8,
              background: "#ffebee",
              color: "#b00020",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            {errorMsg}
          </div>
        )}

        {users.length === 0 ? (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              border: "1px dashed rgba(255,255,255,0.6)",
              background: "rgba(0,0,0,0.25)",
              fontSize: 13,
            }}
          >
            まだユーザー登録はありません。
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
                  <th style={thStyle}>登録日時</th>
                  <th style={thStyle}>氏名</th>
                  <th style={thStyle}>氏名（かな）</th>
                  <th style={thStyle}>メール</th>
                  <th style={thStyle}>生年月日</th>
                  <th style={thStyle}>都道府県</th>
                  <th style={thStyle}>郵便番号</th>
                  <th style={thStyle}>職業</th>
                  <th style={thStyle}>所属</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={tdStyle}>
                      {new Date(u.created_at).toLocaleString("ja-JP")}
                    </td>
                    <td style={tdStyle}>{u.full_name}</td>
                    <td style={tdStyle}>{u.full_name_kana}</td>
                    <td style={tdStyle}>{u.email}</td>
                    <td style={tdStyle}>{u.birth_date}</td>
                    <td style={tdStyle}>{u.prefecture}</td>
                    <td style={tdStyle}>{u.postal_code}</td>
                    <td style={tdStyle}>{u.occupation ?? "-"}</td>
                    <td style={tdStyle}>{u.affiliation ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

export default AdminUsersPage;
