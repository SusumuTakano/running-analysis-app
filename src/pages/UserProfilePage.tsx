// src/pages/UserProfilePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// app_users テーブルの想定カラム
// （full_name / full_name_kana / birth_date / postal_code / prefecture / occupation / affiliation など）
// カラム名が少し違っても動きますが、違う場合はここだけ合わせてください。
type AppUserProfile = {
  id: string;
  full_name: string | null;
  full_name_kana: string | null;
  email: string | null;
  birth_date: string | null;
  postal_code: string | null;
  prefecture: string | null;
  occupation: string | null;
  affiliation: string | null;
};

const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<AppUserProfile | null>(null);

  // フォーム用 state
  const [fullName, setFullName] = useState("");
  const [fullNameKana, setFullNameKana] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [occupation, setOccupation] = useState("");
  const [affiliation, setAffiliation] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setErrorMsg(null);
      setInfoMsg(null);

      // ログイン確認
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        navigate("/login", { replace: true });
        return;
      }

      const authUserId = sessionData.session.user.id;
      const authEmail = sessionData.session.user.email ?? null;

      // app_users から自分のプロフィールを取得
      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .eq("auth_user_id", authUserId)
        .single();

      if (error) {
        setErrorMsg(
          "ユーザー情報の取得に失敗しました。まだ app_users に登録されていない可能性があります。"
        );
        setLoading(false);
        return;
      }

      const p: AppUserProfile = {
        id: data.id,
        full_name: data.full_name ?? null,
        full_name_kana: data.full_name_kana ?? null,
        email: authEmail,
        birth_date: data.birth_date ?? null,
        postal_code: data.postal_code ?? null,
        prefecture: data.prefecture ?? null,
        occupation: data.occupation ?? null,
        affiliation: data.affiliation ?? null,
      };

      setProfile(p);

      setFullName(p.full_name ?? "");
      setFullNameKana(p.full_name_kana ?? "");
      setBirthDate(p.birth_date ?? "");
      setPostalCode(p.postal_code ?? "");
      setPrefecture(p.prefecture ?? "");
      setOccupation(p.occupation ?? "");
      setAffiliation(p.affiliation ?? "");

      setLoading(false);
    };

    loadProfile();
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const { error } = await supabase
      .from("app_users")
      .update({
        full_name: fullName.trim() || null,
        full_name_kana: fullNameKana.trim() || null,
        birth_date: birthDate || null,
        postal_code: postalCode.trim() || null,
        prefecture: prefecture.trim() || null,
        occupation: occupation.trim() || null,
        affiliation: affiliation.trim() || null,
      })
      .eq("id", profile.id);

    if (error) {
      setErrorMsg("ユーザー情報の更新に失敗しました：" + error.message);
    } else {
      setInfoMsg("ユーザー情報を保存しました。");
    }

    setSaving(false);
  };

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
        ユーザー情報を読み込み中です…
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", padding: 24 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div
            style={{
              padding: 20,
              borderRadius: 16,
              background: "rgba(255,255,255,0.96)",
              boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
              border: "1px solid rgba(148,163,184,0.6)",
            }}
          >
            <h1
              style={{
                fontSize: 20,
                marginBottom: 8,
                color: "#111827",
              }}
            >
              ユーザー情報が見つかりません
            </h1>
            <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>
              app_users テーブルにユーザー情報が登録されていないようです。
              <br />
              一度ログアウトして再度ユーザー登録からやり直すか、管理者にお問い合わせください。
            </p>
            <div style={{ marginTop: 16 }}>
              <Link
                to="/dashboard"
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  color: "#111827",
                  fontSize: 12,
                }}
              >
                ← マイページへ戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* ヘッダー */}
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 16,
            background: "rgba(255,255,255,0.96)",
            boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
            border: "1px solid rgba(148,163,184,0.6)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
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
              ユーザー情報
            </h1>
            <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
              アカウントに紐づく基本情報を確認・編集できます。
            </p>
          </div>
          <Link
            to="/dashboard"
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              fontSize: 12,
              color: "#111827",
              background: "#f9fafb",
            }}
          >
            ← マイページへ戻る
          </Link>
        </div>

        {/* フォーム本体 */}
        <form
          onSubmit={handleSave}
          style={{
            padding: 16,
            borderRadius: 16,
            background: "rgba(255,255,255,0.96)",
            boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
            border: "1px solid rgba(148,163,184,0.6)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>メールアドレス（変更不可）</label>
            <input
              type="email"
              value={profile.email ?? ""}
              disabled
              style={{ ...inputStyle, background: "#f3f4f6", color: "#6b7280" }}
            />
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={labelStyle}>氏名</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>氏名（かな）</label>
              <input
                type="text"
                value={fullNameKana}
                onChange={(e) => setFullNameKana(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>生年月日</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>郵便番号</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>所在地（県）</label>
              <input
                type="text"
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>職業（任意）</label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>所属（任意）</label>
              <input
                type="text"
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {errorMsg && (
            <div
              style={{
                marginTop: 12,
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

          {infoMsg && (
            <div
              style={{
                marginTop: 12,
                padding: 8,
                borderRadius: 8,
                background: "#ecfdf5",
                color: "#047857",
                fontSize: 12,
              }}
            >
              {infoMsg}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "none",
                background: saving ? "#9ca3af" : "#2563eb",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "保存中…" : "変更を保存する"}
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
  marginBottom: 4,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 13,
};

export default UserProfilePage;
