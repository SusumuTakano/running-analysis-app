// src/main.tsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";

import App from "./App";
import "./index.css";

import UserLoginPage from "./pages/UserLoginPage";
import UserLogoutPage from "./pages/UserLogoutPage";
import UserRegisterPage from "./pages/UserRegisterPage";
import UserDashboardPage from "./pages/UserDashboardPage";
import UserAthletesPage from "./pages/UserAthletesPage";
import UserProfilePage from "./pages/UserProfilePage";

import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";

import { supabase } from "./lib/supabaseClient";

/** 解析ウィザード（ログイン必須） */
const ProtectedApp: React.FC = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        navigate("/login", { replace: true });
      } else {
        setAuthed(true);
      }
      setChecking(false);
    };

    checkSession();
  }, [navigate]);

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 14,
        }}
      >
        認証情報を確認中です…
      </div>
    );
  }

  if (!authed) return null;

  return <App />;
};

/** 画面上部の太めヘッダーナビ */
const AppTopNav: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ログイン状態をチェック
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        zIndex: 1000,
        backdropFilter: "blur(10px)",
        background:
          "linear-gradient(to right, rgba(248,250,252,0.96), rgba(239,246,255,0.96))",
        borderBottom: "1px solid rgba(148,163,184,0.6)",
        boxShadow: "0 6px 16px rgba(15,23,42,0.12)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          width: "100%",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
        }}
      >
        {/* 左側：タイトル */}
        <Link
          to="/dashboard"
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            ランニング動作解析システム
          </span>
          <span
            style={{
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            for Coaches & Scientists
          </span>
        </Link>

        {/* 右側：メニュー */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* ログイン済みの場合のメニュー */}
          {user ? (
            <>
              <TopNavLink to="/dashboard" label="マイページ" />
              <TopNavLink to="/athletes" label="選手管理" />
              <TopNavLink to="/profile" label="ユーザー情報" />
              <span style={{ height: 26, width: 1, background: "#d1d5db" }} />
              <TopNavLink to="/logout" label="ログアウト" />
              {/* 管理者の場合のみ管理画面リンクを表示 */}
              {user.user_metadata?.is_admin && (
                <>
                  <span style={{ height: 26, width: 1, background: "#d1d5db" }} />
                  <TopNavLink to="/admin" label="管理画面" />
                </>
              )}
            </>
          ) : (
            <>
              {/* 未ログインの場合のメニュー */}
              <TopNavLink to="/login" label="ログイン" />
              <TopNavLink to="/register" label="ユーザー登録" />
              <span style={{ height: 26, width: 1, background: "#d1d5db" }} />
              <TopNavLink to="/admin/login" label="管理者ログイン" />
            </>
          )}
        </nav>
      </div>
    </div>
  );
};

type TopNavLinkProps = {
  to: string;
  label: string;
};

const TopNavLink: React.FC<TopNavLinkProps> = ({ to, label }) => {
  return (
    <Link
      to={to}
      style={{
        color: "#111827",
        textDecoration: "none",
        fontSize: 12,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid transparent",
      }}
    >
      {label}
    </Link>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppTopNav />
      {/* ヘッダー分の余白 */}
      <div style={{ height: 60 }} />
      <Routes>
        {/* 解析ウィザード（ログイン必須） */}
        <Route path="/" element={<ProtectedApp />} />

        {/* 一般ユーザー向け */}
        <Route path="/dashboard" element={<UserDashboardPage />} />
        <Route path="/athletes" element={<UserAthletesPage />} />
        <Route path="/profile" element={<UserProfilePage />} />
        <Route path="/login" element={<UserLoginPage />} />
        <Route path="/logout" element={<UserLogoutPage />} />
        <Route path="/register" element={<UserRegisterPage />} />

        {/* 管理者向け */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
