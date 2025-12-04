// src/pages/admin/AdminLoginPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    // ログイン成功 → 管理画面トップへ
    setLoading(false);
    navigate("/admin", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        padding: "16px",
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          background: "#fff",
          padding: "24px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ fontSize: "20px", marginBottom: "16px" }}>
          管理者ログイン
        </h1>
        <p style={{ fontSize: "13px", marginBottom: "16px" }}>
          ランニング分析データの管理画面にログインします。
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: "13px", marginBottom: 4 }}>
            メールアドレス
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "8px",
              marginBottom: "12px",
              fontSize: "14px",
            }}
          />

          <label style={{ display: "block", fontSize: "13px", marginBottom: 4 }}>
            パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "8px",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          />

          {errorMsg && (
            <div
              style={{
                color: "#b00020",
                fontSize: "12px",
                marginBottom: "12px",
                whiteSpace: "pre-wrap",
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 0",
              fontSize: "14px",
              fontWeight: 600,
              background: "#1976d2",
              color: "#fff",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "ログイン中…" : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
