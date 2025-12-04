// src/pages/UserRegisterPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const UserRegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [fullNameKana, setFullNameKana] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [occupation, setOccupation] = useState("");
  const [affiliation, setAffiliation] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 郵便番号から都道府県を自動取得（zipcloud を利用）
  const handlePostalBlur = async () => {
    const cleaned = postalCode.replace(/[^\d]/g, "");
    if (cleaned.length !== 7) return;

    try {
      const res = await fetch(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleaned}`
      );
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        setPrefecture(result.address1 ?? "");
      } else {
        setErrorMsg("郵便番号から住所を取得できませんでした。");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("郵便番号検索でエラーが発生しました。");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);

    if (password !== passwordConfirm) {
      setErrorMsg("パスワードと確認用パスワードが一致しません。");
      return;
    }

    if (!prefecture) {
      setErrorMsg("所在地（県）が空です。郵便番号から自動取得するか、直接入力してください。");
      return;
    }

    setSubmitting(true);

    try {
      // ① Supabase Auth にユーザー登録
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setErrorMsg("ユーザー登録に失敗しました: " + signUpError.message);
        setSubmitting(false);
        return;
      }

      const authUserId = data.user?.id ?? null;

      // ② プロファイル情報を app_users テーブルに保存
      const cleanedPostal = postalCode.replace(/[^\d]/g, "");

      const { error: insertError } = await supabase.from("app_users").insert({
        auth_user_id: authUserId,
        full_name: fullName,
        full_name_kana: fullNameKana,
        email,
        birth_date: birthDate,
        postal_code: cleanedPostal,
        prefecture,
        occupation: occupation || null,
        affiliation: affiliation || null,
      });

      if (insertError) {
        setErrorMsg("ユーザー情報の保存に失敗しました: " + insertError.message);
        setSubmitting(false);
        return;
      }

      setMessage(
         "ユーザー登録が完了しました。登録したメールアドレスとパスワードは大切に保管してください。"
      );

      // フォームを軽くリセット
      setPassword("");
      setPasswordConfirm("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("予期せぬエラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
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
          maxWidth: 600,
          background: "rgba(0,0,0,0.35)",
          borderRadius: 16,
          padding: 24,
          border: "1px solid rgba(255,255,255,0.3)",
        }}
      >
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>ユーザー登録</h1>
        <p style={{ fontSize: 13, marginBottom: 16 }}>
          ランニング動作解析アプリを利用するためのユーザー登録フォームです。
        </p>

        <form onSubmit={handleSubmit}>
          {/* 氏名 */}
          <label style={labelStyle}>
            氏名<span style={requiredMark}>*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            style={inputStyle}
          />

          {/* 氏名かな */}
          <label style={labelStyle}>
            氏名（かな）<span style={requiredMark}>*</span>
          </label>
          <input
            type="text"
            value={fullNameKana}
            onChange={(e) => setFullNameKana(e.target.value)}
            required
            style={inputStyle}
          />

          {/* メール */}
          <label style={labelStyle}>
            メールアドレス<span style={requiredMark}>*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />

          {/* パスワード */}
          <label style={labelStyle}>
            パスワード<span style={requiredMark}>*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          {/* パスワード確認 */}
          <label style={labelStyle}>
            パスワード（確認）<span style={requiredMark}>*</span>
          </label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            style={inputStyle}
          />

          {/* 生年月日 */}
          <label style={labelStyle}>
            生年月日<span style={requiredMark}>*</span>
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
            style={inputStyle}
          />

          {/* 郵便番号 */}
          <label style={labelStyle}>
            郵便番号<span style={requiredMark}>*</span>（ハイフンなし 7桁）
          </label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            onBlur={handlePostalBlur}
            required
            style={inputStyle}
            placeholder="例: 2591292"
          />

          {/* 所在地（県） */}
          <label style={labelStyle}>
            所在地（県）<span style={requiredMark}>*</span>
          </label>
          <input
            type="text"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            required
            style={inputStyle}
            placeholder="郵便番号から自動入力されます"
          />

          {/* 職業（任意） */}
          <label style={labelStyle}>職業（任意）</label>
          <input
            type="text"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            style={inputStyle}
          />

          {/* 所属（任意） */}
          <label style={labelStyle}>所属（任意）</label>
          <input
            type="text"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
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
                background: "rgba(0,0,0,0.4)",
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
              {submitting ? "登録中…" : "登録する"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
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
              トップへ戻る
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

const requiredMark: React.CSSProperties = {
  color: "#ffeb3b",
  marginLeft: 4,
};

export default UserRegisterPage;
