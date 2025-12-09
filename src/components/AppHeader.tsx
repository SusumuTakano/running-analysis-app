// src/components/AppHeader.tsx
import React, { useState } from "react";
import "../App.css";

export const AppHeader: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {/* タイトル部分 */}
        <div className="app-title-block">
          <div className="app-title-main">ランニング動作解析システム</div>
          <div className="app-title-sub">
            for Coaches &amp; Scientists
          </div>
        </div>

        {/* ハンバーガーボタン（スマホ用） */}
        <button
          type="button"
          className={`app-menu-button ${menuOpen ? "is-open" : ""}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="メニューを開く"
        >
          <span />
          <span />
          <span />
        </button>

        {/* ナビゲーション */}
        <nav className={`app-nav ${menuOpen ? "is-open" : ""}`}>
          <a href="/login" className="app-nav-link">
            ログイン
          </a>
          <a href="/signup" className="app-nav-link">
            ユーザー登録
          </a>
          <a href="/admin/login" className="app-nav-link">
            管理者ログイン
          </a>
        </nav>
      </div>
    </header>
  );
};
