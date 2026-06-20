// src/pages/admin/AdminBillingPage.tsx
// 決済・サブスク管理（super_admin 限定）。フェーズB で Stripe 連携を実装予定のプレースホルダー。
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const AdminBillingPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate("/admin/login", { replace: true });
        return;
      }
      const { data: tier } = await supabase.rpc("get_my_admin_tier");
      if (tier !== "super_admin") {
        navigate("/admin", { replace: true });
        return;
      }
      setAuthorized(true);
      setLoading(false);
    };
    init();
  }, [navigate]);

  if (loading) return <div style={page}>読み込み中…</div>;
  if (!authorized) return null;

  return (
    <div style={page}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontSize: 22 }}>決済管理</h1>
          <Link to="/admin" style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.6)", fontSize: 12, color: "#fff", textDecoration: "none" }}>
            ← 管理トップへ戻る
          </Link>
        </header>

        <div style={{ padding: 24, borderRadius: 12, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.2)", fontSize: 14, lineHeight: 1.8 }}>
          <p style={{ marginBottom: 12 }}>🚧 決済・サブスク管理はフェーズBで実装予定です。</p>
          <p style={{ fontSize: 13, opacity: 0.85 }}>
            予定機能：Stripe 連携によるサブスクリプションのプラン管理、支払い状況の確認、Customer Portal 連携。
          </p>
        </div>
      </div>
    </div>
  );
};

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  color: "#fff",
  background: "linear-gradient(135deg, #0b1220 0%, #0f172a 40%, #1e3a8a 100%)",
};

export default AdminBillingPage;
