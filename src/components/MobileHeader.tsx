import React, { useState } from 'react';

interface MobileHeaderProps {
  userProfile?: { name: string };
  onNewAnalysis?: () => void;
  onShowTutorial?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ 
  userProfile, 
  onNewAnalysis, 
  onShowTutorial 
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          /* ハンバーガーメニュースタイル */
          .mobile-header-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 10px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            height: 40px;
          }

          .mobile-header-title {
            font-size: 16px;
            color: white;
            font-weight: bold;
            margin: 0;
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .hamburger-button {
            width: 30px;
            height: 30px;
            background: none;
            border: none;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            justify-content: space-around;
            padding: 4px;
          }

          .hamburger-line {
            width: 22px;
            height: 2px;
            background: white;
            transition: all 0.3s;
          }

          .hamburger-button.open .hamburger-line:nth-child(1) {
            transform: rotate(45deg) translateY(8px);
          }

          .hamburger-button.open .hamburger-line:nth-child(2) {
            opacity: 0;
          }

          .hamburger-button.open .hamburger-line:nth-child(3) {
            transform: rotate(-45deg) translateY(-8px);
          }

          .mobile-menu-overlay {
            position: fixed;
            top: 40px;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: none;
            z-index: 9998;
          }

          .mobile-menu-overlay.open {
            display: block;
          }

          .mobile-menu {
            position: fixed;
            top: 40px;
            right: -300px;
            width: 250px;
            height: auto;
            background: white;
            box-shadow: -2px 0 10px rgba(0,0,0,0.2);
            transition: right 0.3s;
            z-index: 9999;
            border-radius: 0 0 0 10px;
          }

          .mobile-menu.open {
            right: 0;
          }

          .mobile-menu-item {
            padding: 15px 20px;
            border-bottom: 1px solid #e5e7eb;
            color: #374151;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: background 0.2s;
          }

          .mobile-menu-item:active {
            background: #f3f4f6;
          }

          .mobile-menu-user {
            padding: 15px 20px;
            background: #f9fafb;
            font-size: 12px;
            color: #6b7280;
            border-bottom: 2px solid #e5e7eb;
          }

          /* 既存のヘッダーを隠す */
          .app-header-new {
            display: none !important;
          }

          /* コンテンツの上部余白 */
          .wizard-main,
          .app-container > div:first-of-type {
            margin-top: 40px !important;
          }
        }

        @media (min-width: 769px) {
          .mobile-header-container,
          .mobile-menu-overlay,
          .mobile-menu {
            display: none !important;
          }
        }
      `}</style>

      {/* モバイルヘッダー */}
      {window.innerWidth <= 768 && (
        <>
          <div className="mobile-header-container">
            <div style={{ flex: 1 }}></div>
            <button 
              className={`hamburger-button ${isMenuOpen ? 'open' : ''}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
          </div>

          {/* メニューオーバーレイ */}
          <div 
            className={`mobile-menu-overlay ${isMenuOpen ? 'open' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          />

          {/* スライドメニュー */}
          <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
            {userProfile && (
              <div className="mobile-menu-user">
                👤 {userProfile.name}
              </div>
            )}
            <div 
              className="mobile-menu-item"
              onClick={() => {
                onShowTutorial?.();
                setIsMenuOpen(false);
              }}
            >
              ❓ 使い方
            </div>
            <div 
              className="mobile-menu-item"
              onClick={() => {
                onNewAnalysis?.();
                setIsMenuOpen(false);
              }}
            >
              ➕ 新しい解析
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileHeader;