// src/pages/UserLogoutPage.tsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const UserLogoutPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const doLogout = async () => {
      // Supabase のセッションを破棄
      await supabase.auth.signOut();
      // ログイン画面へ戻す
      navigate("/login", { replace: true });
    };

    doLogout();
  }, [navigate]);

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
      ログアウト中です…
    </div>
  );
};

export default UserLogoutPage;
