// src/pages/ForgotPasswordPage.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);
    setSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setErrorMsg("メール送信に失敗しました: " + error.message);
      setSubmitting(false);
      return;
    }

    setMessage(
      "リセット用のメールを送信しました。メール内のリンクから新しいパスワードを設定してください。"
    );
    setSubmitting(false);
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
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>パスワードをお忘れの方</h1>
        <p style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
          登録済みのメールアドレスを入力してください。パスワード再設定用のメールをお送りします。
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

          {message && (
            <div
              style={{
                marginTop: 12,
                padding: 8,
                borderRadius: 8,
                background: "rgba(34,197,94,0.2)",
                border: "1px solid rgba(34,197,94,0.6)",
                fontSize: 12,
              }}
            >
              {message}
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 999,
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                background: submitting ? "#666" : "#2196f3",
                color: "#fff",
                cursor: submitting ? "default" : "pointer",
              }}
            >
              {submitting ? "送信中…" : "リセットメールを送信"}
            </button>
            <Link
              to="/login"
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.6)",
                background: "transparent",
                color: "#fff",
                fontSize: 13,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              ログインへ戻る
            </Link>
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
  background: "#fff",
  color: "#0f172a",
  fontSize: 13,
};

export default ForgotPasswordPage;
