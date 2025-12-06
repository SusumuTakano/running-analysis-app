import React, { useState, useEffect } from 'react';

interface MobileHeaderProps {
  userProfile?: { name: string };
  onNewAnalysis?: () => void;
  onShowTutorial?: () => void;
}

export const MobileHeaderUltimate: React.FC<MobileHeaderProps> = ({ 
  userProfile, 
  onNewAnalysis, 
  onShowTutorial 
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // 即座にスタイルを追加
    const addStyles = () => {
      // 既存のスタイルタグを削除
      const existingStyle = document.getElementById('mobile-header-ultimate-styles');
      if (existingStyle) {
        existingStyle.remove();
      }

      const style = document.createElement('style');
      style.id = 'mobile-header-ultimate-styles';
      style.textContent = `
        @media (max-width: 768px) {
          /* 既存のヘッダーとそのすべての子要素を完全に隠す */
          .app-header-new,
          .app-header-new *,
          header,
          header *,
          [class*="header"],
          [class*="Header"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            pointer-events: none !important;
          }
          
          /* モバイルヘッダーだけを表示 */
          .mobile-header-ultimate {
            display: flex !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: 40px !important;
            background: #4a5568 !important;
            z-index: 999999 !important;
            justify-content: flex-end !important;
            align-items: center !important;
            padding: 0 10px !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3) !important;
          }
          
          /* コンテンツのマージン調整 */
          .app-container,
          .wizard-main,
          main,
          [class*="container"] {
            margin-top: 45px !important;
            padding-top: 10px !important;
          }
          
          /* ハンバーガーボタン */
          .ultimate-hamburger-btn {
            width: 35px !important;
            height: 35px !important;
            background: transparent !important;
            border: none !important;
            cursor: pointer !important;
            padding: 5px !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-around !important;
            align-items: center !important;
            position: relative !important;
            z-index: 1000001 !important;
          }
          
          .ultimate-hamburger-line {
            width: 25px !important;
            height: 3px !important;
            background: white !important;
            border-radius: 2px !important;
            transition: all 0.3s !important;
            display: block !important;
          }
          
          .ultimate-hamburger-btn.open .ultimate-hamburger-line:nth-child(1) {
            transform: rotate(45deg) translate(6px, 6px) !important;
          }
          
          .ultimate-hamburger-btn.open .ultimate-hamburger-line:nth-child(2) {
            opacity: 0 !important;
            transform: scale(0) !important;
          }
          
          .ultimate-hamburger-btn.open .ultimate-hamburger-line:nth-child(3) {
            transform: rotate(-45deg) translate(7px, -7px) !important;
          }
          
          /* メニュー */
          .ultimate-mobile-menu {
            position: fixed !important;
            top: 40px !important;
            right: -300px !important;
            width: 250px !important;
            max-height: calc(100vh - 40px) !important;
            background: white !important;
            box-shadow: -2px 2px 10px rgba(0,0,0,0.3) !important;
            transition: right 0.3s ease !important;
            z-index: 1000000 !important;
            overflow-y: auto !important;
          }
          
          .ultimate-mobile-menu.open {
            right: 0 !important;
          }
          
          .ultimate-menu-item {
            padding: 15px 20px !important;
            border-bottom: 1px solid #e0e0e0 !important;
            background: white !important;
            color: #333 !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            font-size: 14px !important;
            transition: background 0.2s !important;
          }
          
          .ultimate-menu-item:active {
            background: #f5f5f5 !important;
          }
          
          .ultimate-menu-item span {
            margin-right: 10px !important;
            font-size: 18px !important;
          }
          
          /* オーバーレイ */
          .ultimate-menu-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.3) !important;
            z-index: 999999 !important;
            display: none !important;
          }
          
          .ultimate-menu-overlay.open {
            display: block !important;
          }
        }
        
        /* デスクトップでは非表示 */
        @media (min-width: 769px) {
          .mobile-header-ultimate,
          .ultimate-mobile-menu,
          .ultimate-menu-overlay {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(style);
      
      // 既存のヘッダーをさらに確実に隠す
      setTimeout(() => {
        const headers = document.querySelectorAll('.app-header-new, header, [class*="header"], [class*="Header"]');
        headers.forEach(header => {
          if (window.innerWidth <= 768) {
            (header as HTMLElement).style.cssText = 'display: none !important; height: 0 !important; visibility: hidden !important;';
          }
        });
      }, 100);
    };

    // 即座に実行
    addStyles();
    
    // リサイズ時も再適用
    window.addEventListener('resize', addStyles);
    
    // DOMContentLoadedでも実行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addStyles);
    }
    
    return () => {
      window.removeEventListener('resize', addStyles);
    };
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleMenuClick = (action: (() => void) | undefined) => {
    if (action) {
      action();
    }
    setIsMenuOpen(false);
  };

  // モバイルのみレンダリング
  if (typeof window !== 'undefined' && window.innerWidth > 768) {
    return null;
  }

  return (
    <>
      {/* モバイルヘッダー */}
      <div className="mobile-header-ultimate">
        <button 
          className={`ultimate-hamburger-btn ${isMenuOpen ? 'open' : ''}`}
          onClick={toggleMenu}
        >
          <span className="ultimate-hamburger-line"></span>
          <span className="ultimate-hamburger-line"></span>
          <span className="ultimate-hamburger-line"></span>
        </button>
      </div>

      {/* オーバーレイ */}
      <div 
        className={`ultimate-menu-overlay ${isMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* メニュー */}
      <div className={`ultimate-mobile-menu ${isMenuOpen ? 'open' : ''}`}>
        <div 
          className="ultimate-menu-item"
          onClick={() => handleMenuClick(onNewAnalysis)}
        >
          <span>🆕</span>
          新しい解析を開始
        </div>
        
        <div 
          className="ultimate-menu-item"
          onClick={() => handleMenuClick(onShowTutorial)}
        >
          <span>📖</span>
          使い方を見る
        </div>
        
        {userProfile && (
          <div className="ultimate-menu-item">
            <span>👤</span>
            {userProfile.name}
          </div>
        )}
        
        <div className="ultimate-menu-item">
          <span>⚙️</span>
          設定
        </div>
        
        <div className="ultimate-menu-item">
          <span>📊</span>
          解析履歴
        </div>
      </div>
    </>
  );
};

export default MobileHeaderUltimate;