// src/pages/UserLoginPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const UserLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg("ログインに失敗しました：" + error.message);
      setLoading(false);
      return;
    }

    // ログイン成功 → ユーザーダッシュボードへ
    setLoading(false);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "rgba(0,0,0,0.35)",
          borderRadius: 16,
          padding: 24,
          border: "1px solid rgba(255,255,255,0.3)",
        }}
      >
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>ログイン</h1>
        <p style={{ fontSize: 13, marginBottom: 16 }}>
          ユーザー登録済みのメールアドレスとパスワードでログインしてください。
        </p>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />

          <label style={labelStyle}>パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          {errorMsg && (
            <div
              style={{
                marginTop: 12,
                padding: 8,
                borderRadius: 8,
                background: "#ffebee",
                color: "#b00020",
                fontSize: 12,
              }}
            >
              {errorMsg}
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 999,
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                background: loading ? "#666" : "#2196f3",
                color: "#fff",
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "ログイン中…" : "ログイン"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/register")}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.6)",
                background: "transparent",
                color: "#fff",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              新規登録へ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  marginTop: 10,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.5)",
  background: "rgba(0,0,0,0.2)",
  color: "#fff",
  fontSize: 13,
};

export default UserLoginPage;
