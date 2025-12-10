// src/main.tsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
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
          color: "#111827",
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
};

/** 共通：リンク部品（PC / モバイル共通で使用） */
const TopNavLink: React.FC<TopNavLinkProps> = ({ to, label, onClick }) => {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        color: "#111827",
        textDecoration: "none",
        fontSize: 12,
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid transparent",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {label}
    </Link>
  );
};

/** 画面上部のヘッダーナビ（PC：メニュー横並び / スマホ：タイトル＋ハンバーガー） */
const AppTopNav: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const location = useLocation();

  // 画面幅からモバイル判定
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth <= 768);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

  // ルートが変わったらモバイルメニューを閉じる
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const isAdmin = !!user?.user_metadata?.is_admin;

  /** PC 用ナビゲーション */
  const renderDesktopNav = () => {
    if (loading) {
      // ローディング中は空白だけ
      return <div style={{ width: 320 }} />;
    }

    if (user) {
      return (
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <TopNavLink to="/dashboard" label="マイページ" />
          <TopNavLink to="/athletes" label="選手管理" />
          <TopNavLink to="/profile" label="ユーザー情報" />
          <span
            style={{ height: 26, width: 1, background: "#d1d5db", margin: "0 4px" }}
          />
          <TopNavLink to="/logout" label="ログアウト" />
          {isAdmin && (
            <>
              <span
                style={{
                  height: 26,
                  width: 1,
                  background: "#d1d5db",
                  margin: "0 4px",
                }}
              />
              <TopNavLink to="/admin" label="管理画面" />
            </>
          )}
        </nav>
      );
    }

    // 未ログイン
    return (
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <TopNavLink to="/login" label="ログイン" />
        <TopNavLink to="/register" label="ユーザー登録" />
        <span
          style={{ height: 26, width: 1, background: "#d1d5db", margin: "0 4px" }}
        />
        <TopNavLink to="/admin/login" label="管理者ログイン" />
      </nav>
    );
  };

  /** モバイル用のメニュー一覧 */
  const renderMobileMenuItems = () => {
    if (loading) {
      return (
        <div
          style={{
            padding: "8px 4px",
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          認証状態を確認中…
        </div>
      );
    }

    if (user) {
      return (
        <>
          <TopNavLink
            to="/dashboard"
            label="マイページ"
            onClick={() => setIsMenuOpen(false)}
          />
          <TopNavLink
            to="/athletes"
            label="選手管理"
            onClick={() => setIsMenuOpen(false)}
          />
          <TopNavLink
            to="/profile"
            label="ユーザー情報"
            onClick={() => setIsMenuOpen(false)}
          />
          <TopNavLink
            to="/logout"
            label="ログアウト"
            onClick={() => setIsMenuOpen(false)}
          />
          {isAdmin && (
            <TopNavLink
              to="/admin"
              label="管理画面"
              onClick={() => setIsMenuOpen(false)}
            />
          )}
        </>
      );
    }

    // 未ログイン時
    return (
      <>
        <TopNavLink
          to="/login"
          label="ログイン"
          onClick={() => setIsMenuOpen(false)}
        />
        <TopNavLink
          to="/register"
          label="ユーザー登録"
          onClick={() => setIsMenuOpen(false)}
        />
        <TopNavLink
          to="/admin/login"
          label="管理者ログイン"
          onClick={() => setIsMenuOpen(false)}
        />
      </>
    );
  };

  return (
    <>
      {/* 固定ヘッダー本体 */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          zIndex: 2000,
          backdropFilter: "blur(10px)",
          background:
            "linear-gradient(to right, rgba(248,250,252,0.96), rgba(239,246,255,0.96))",
          borderBottom: "1px solid rgba(148,163,184,0.6)",
          boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
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
            gap: 12,
          }}
        >
          {/* 左：タイトル */}
          <Link
            to="/dashboard"
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
                fontSize: isMobile ? 13 : 16,
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
                for Coaches &amp; Scientists
              </span>
            )}
          </Link>

          {/* 右：PC では横並びメニュー / モバイルではハンバーガー */}
      {isMobile && (
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.9)",
              backgroundColor: "rgba(255,255,255,0.96)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: 0,
              boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
            }}
            aria-label="メニュー"
          >
            <span
              style={{
                display: "block",
                width: 18,
                height: 2,
                borderRadius: 999,
                backgroundColor: "#111827",
              }}
            />
            <span
              style={{
                display: "block",
                width: 18,
                height: 2,
                borderRadius: 999,
                backgroundColor: "#111827",
              }}
            />
            <span
              style={{
                display: "block",
                width: 18,
                height: 2,
                borderRadius: 999,
                backgroundColor: "#111827",
              }}
            />
          </button>
        )}
        </div>
      </div>

      {/* モバイル用ドロワーメニュー */}
      {isMobile && isMenuOpen && (
        <div
          style={{
            position: "fixed",
            top: 56,
            left: 0,
            right: 0,
            zIndex: 1999,
            backgroundColor: "rgba(15,23,42,0.25)", // 画面全体の薄いオーバーレイ
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "8px auto 12px",          // 上に少し余白
              width: "100%",
              padding: "8px 12px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              backgroundColor: "#ffffff",       // ★ メニュー本体を白背景に
              borderRadius: 12,
              boxShadow: "0 10px 25px rgba(15,23,42,0.18)", // 影でカードっぽく
            }}
          >
            {renderMobileMenuItems()}
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
      {/* 固定ヘッダー分の余白（56px） */}
      <div style={{ height: 56 }} />
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
