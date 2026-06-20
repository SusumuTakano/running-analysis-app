// src/pages/ResetPasswordPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabaseはリセットメールのリンクを踏むと一時的なセッションを張る
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setErrorMsg(
          "リセットリンクが無効または期限切れです。再度メール送信からやり直してください。"
        );
      }
      setReady(true);
    };
    check();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);

    if (password.length < 6) {
      setErrorMsg("パスワードは6文字以上で入力してください。");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMsg("パスワードと確認用パスワードが一致しません。");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMsg("パスワードの更新に失敗しました: " + error.message);
      setSubmitting(false);
      return;
    }

    setMessage("パスワードを更新しました。3秒後にログイン画面へ移動します。");
    setSubmitting(false);

    setTimeout(() => {
      supabase.auth.signOut().finally(() => navigate("/login", { replace: true }));
    }, 3000);
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
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>新しいパスワードを設定</h1>
        <p style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
          新しいパスワードを入力してください（6文字以上）。
        </p>

        {ready && (
          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>新しいパスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={inputStyle}
            />

            <label style={labelStyle}>新しいパスワード（確認）</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={6}
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

            <div style={{ marginTop: 20 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%",
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
                {submitting ? "更新中…" : "パスワードを更新"}
              </button>
            </div>
          </form>
        )}
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

export default ResetPasswordPage;
