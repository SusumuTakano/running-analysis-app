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

type TopNavLinkProps = {
  to: string;
  label: string;
  onClick?: () => void;
  variant?: "desktop" | "mobile";
};

const TopNavLink: React.FC<TopNavLinkProps> = ({
  to,
  label,
  onClick,
  variant = "desktop",
}) => {
  const baseStyle: React.CSSProperties = {
    color: "#111827",
    textDecoration: "none",
    fontSize: variant === "desktop" ? 12 : 14,
    padding: variant === "desktop" ? "6px 10px" : "10px 14px",
    borderRadius: 999,
    border: "1px solid transparent",
    display: variant === "desktop" ? "inline-flex" : "block",
  };

  return (
    <Link to={to} style={baseStyle} onClick={onClick}>
      {label}
    </Link>
  );
};

/** 画面上部の太めヘッダーナビ（モバイルはハンバーガー） */
const AppTopNav: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // 画面幅からモバイル判定
  useEffect(() => {
    const updateIsMobile = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth <= 768);
      }
    };
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  // ログイン状態をチェック
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // 認証状態の変更を監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // メニュー内容
  const renderLinks = (variant: "desktop" | "mobile") => {
    const linkProps = { variant, onClick: () => setMenuOpen(false) };

    if (user) {
      return (
        <>
          <TopNavLink to="/dashboard" label="マイページ" {...linkProps} />
          <TopNavLink to="/athletes" label="選手管理" {...linkProps} />
          <TopNavLink to="/profile" label="ユーザー情報" {...linkProps} />
          <TopNavLink to="/logout" label="ログアウト" {...linkProps} />
          {user.user_metadata?.is_admin && (
            <TopNavLink to="/admin" label="管理画面" {...linkProps} />
          )}
        </>
      );
    }

    // 未ログイン
    return (
      <>
        <TopNavLink to="/login" label="ログイン" {...linkProps} />
        <TopNavLink to="/register" label="ユーザー登録" {...linkProps} />
        <TopNavLink
          to="/admin/login"
          label="管理者ログイン"
          {...linkProps}
        />
      </>
    );
  };

  return (
    <>
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
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
          }}
        >
          {/* 左側：タイトルのみ（クリックでマイページ） */}
          <Link
            to={user ? "/dashboard" : "/login"}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              textDecoration: "none",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
            >
              ランニング動作解析システム
            </span>
            {!isMobile && (
              <span
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                for Coaches & Scientists
              </span>
            )}
          </Link>

          {/* 右側：PCは通常メニュー、スマホはハンバーガー */}
          {isMobile ? (
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.8)",
                background: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                cursor: "pointer",
              }}
              aria-label="メニュー"
            >
              <div
                style={{
                  width: 18,
                  height: 2,
                  background: "#111827",
                  position: "relative",
                  borderRadius: 999,
                }}
              >
                <span
                  style={{
                    content: '""',
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: -6,
                    height: 2,
                    background: "#111827",
                    borderRadius: 999,
                  }}
                />
                <span
                  style={{
                    content: '""',
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 6,
                    height: 2,
                    background: "#111827",
                    borderRadius: 999,
                  }}
                />
              </div>
            </button>
          ) : (
            <nav
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              {renderLinks("desktop")}
            </nav>
          )}
        </div>
      </div>

      {/* モバイル用のドロワーメニュー */}
      {isMobile && menuOpen && (
        <div
          style={{
            position: "fixed",
            top: 60,
            right: 0,
            left: 0,
            zIndex: 900,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            style={{
              margin: "8px 12px 16px",
              background: "white",
              borderRadius: 12,
              padding: 8,
              boxShadow: "0 10px 25px rgba(15,23,42,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {renderLinks("mobile")}
          </div>
        </div>
      )}
    </>
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
