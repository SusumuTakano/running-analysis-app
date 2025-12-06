import React, { useState, useEffect } from 'react';

interface MobileHeaderProps {
  userProfile?: { name: string };
  onNewAnalysis?: () => void;
  onShowTutorial?: () => void;
}

export const MobileHeaderFixed: React.FC<MobileHeaderProps> = ({ 
  userProfile, 
  onNewAnalysis, 
  onShowTutorial 
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // CSSを即座に適用
    const style = document.createElement('style');
    style.id = 'mobile-header-styles';
    style.textContent = `
      @media (max-width: 768px) {
        /* 既存のヘッダーを完全に隠す */
        .app-header-new {
          display: none !important;
        }
        
        /* モバイルヘッダー */
        .mobile-header-fixed {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          z-index: 10000;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding: 0 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        
        /* ハンバーガーボタン */
        .hamburger-btn {
          width: 30px;
          height: 30px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          align-items: center;
        }
        
        .hamburger-line {
          width: 20px;
          height: 2px;
          background: white;
          transition: all 0.3s;
          transform-origin: center;
        }
        
        .hamburger-btn.open .hamburger-line:nth-child(1) {
          transform: rotate(45deg) translateY(7px);
        }
        
        .hamburger-btn.open .hamburger-line:nth-child(2) {
          opacity: 0;
        }
        
        .hamburger-btn.open .hamburger-line:nth-child(3) {
          transform: rotate(-45deg) translateY(-7px);
        }
        
        /* メニュー */
        .mobile-menu-fixed {
          position: fixed;
          top: 40px;
          right: -250px;
          width: 200px;
          background: white;
          box-shadow: -2px 0 10px rgba(0,0,0,0.2);
          transition: right 0.3s;
          z-index: 9999;
          border-radius: 0 0 0 10px;
        }
        
        .mobile-menu-fixed.open {
          right: 0;
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
        
        .menu-item {
          padding: 15px;
          border-bottom: 1px solid #e5e7eb;
          color: #374151;
          font-size: 14px;
          cursor: pointer;
        }
        
        .menu-item:active {
          background: #f3f4f6;
        }
        
        /* コンテンツの上部余白 */
        .wizard-main,
        .wizard-content,
        .step-progress {
          margin-top: 40px !important;
        }
        
        .app-container {
          padding-top: 40px !important;
        }
      }
    `;
    
    if (!document.getElementById('mobile-header-styles')) {
      document.head.appendChild(style);
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      const existingStyle = document.getElementById('mobile-header-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  if (!isMobile) return null;

  return (
    <>
      <div className="mobile-header-fixed">
        <button 
          className={`hamburger-btn ${isMenuOpen ? 'open' : ''}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
      </div>

      <div 
        className={`mobile-menu-overlay ${isMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMenuOpen(false)}
      />

      <div className={`mobile-menu-fixed ${isMenuOpen ? 'open' : ''}`}>
        {userProfile && (
          <div className="menu-item" style={{ background: '#f9fafb' }}>
            👤 {userProfile.name}
          </div>
        )}
        <div 
          className="menu-item"
          onClick={() => {
            onShowTutorial?.();
            setIsMenuOpen(false);
          }}
        >
          ❓ 使い方
        </div>
        <div 
          className="menu-item"
          onClick={() => {
            onNewAnalysis?.();
            setIsMenuOpen(false);
          }}
        >
          ➕ 新しい解析
        </div>
      </div>
    </>
  );
};

export default MobileHeaderFixed;