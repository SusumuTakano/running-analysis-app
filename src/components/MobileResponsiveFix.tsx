import React, { useEffect } from 'react';

/**
 * モバイルレスポンシブ対応のための修正コンポーネント
 * App.tsxに最小限の変更で追加できるユーティリティ
 */
export const MobileResponsiveFix: React.FC = () => {
  useEffect(() => {
    // ビューポート設定を強制
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(meta);
    }

    // iOS特有の修正
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      // iOS Safariのアドレスバー対策
      document.documentElement.style.height = '100%';
      document.body.style.height = '100%';
      document.body.style.position = 'relative';
      
      // プルダウンリフレッシュを無効化
      document.body.style.overscrollBehavior = 'none';
      
      // タッチイベントの最適化
      let touchStartY = 0;
      const handleTouchStart = (e: TouchEvent) => {
        touchStartY = e.touches[0].clientY;
      };
      
      const handleTouchMove = (e: TouchEvent) => {
        const touchY = e.touches[0].clientY;
        const touchDiff = touchY - touchStartY;
        
        // スクロールが最上部でさらに下にスワイプしようとしたら防ぐ
        if (window.scrollY === 0 && touchDiff > 0) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchstart', handleTouchStart, { passive: false });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      
      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
      };
    }
  }, []);

  return null;
};

/**
 * モバイル用のテーブルラッパー
 * 横スクロール可能なテーブルを作成
 */
export const MobileTableWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div style={{
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      margin: '0 -10px',
      padding: '0 10px'
    }}>
      <div style={{
        minWidth: '100%',
        display: 'inline-block'
      }}>
        {children}
      </div>
    </div>
  );
};

/**
 * モバイル用のヘッダー修正
 * ヘッダーテキストを適切に折り返し
 */
export const MobileHeaderFix: React.FC = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        /* ヘッダータイトルの修正 */
        .app-title-new {
          font-size: min(5vw, 1.5rem) !important;
          white-space: normal !important;
          line-height: 1.2 !important;
          word-break: keep-all !important;
        }
        
        /* サブタイトルの修正 */
        .app-subtitle-new {
          font-size: min(3vw, 0.85rem) !important;
          white-space: normal !important;
          word-break: keep-all !important;
          padding: 0 10px !important;
        }
        
        /* ヘッダー内のボタン群 */
        .app-header-new button {
          font-size: min(3.5vw, 0.85rem) !important;
          padding: 6px 8px !important;
        }
        
        /* ヘッダー全体のレイアウト */
        .app-header-new > div {
          flex-wrap: wrap !important;
          justify-content: center !important;
          gap: 8px !important;
        }
        
        /* ユーザー名を非表示 */
        .app-header-new span:last-child {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  return null;
};

/**
 * マーカー配置テーブルの修正
 */
export const MarkerTableFix: React.FC = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        /* マーカー配置テーブルのコンテナ */
        .marker-placement-container {
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
          margin: 0 -15px !important;
          padding: 0 15px !important;
        }
        
        /* テーブル本体 */
        .marker-placement-table {
          min-width: 600px !important;
          width: 100% !important;
        }
        
        /* テーブルのセル */
        .marker-placement-table th,
        .marker-placement-table td {
          padding: 8px 4px !important;
          font-size: 0.75rem !important;
          white-space: nowrap !important;
        }
        
        /* 入力フィールド */
        .marker-placement-table input[type="number"] {
          width: 50px !important;
          padding: 4px 2px !important;
          font-size: 0.75rem !important;
        }
        
        /* ボタン */
        .marker-placement-table button {
          padding: 4px 6px !important;
          font-size: 0.7rem !important;
          white-space: nowrap !important;
        }
        
        /* マーカータイプの表示 */
        .marker-type-badge {
          font-size: 0.65rem !important;
          padding: 2px 4px !important;
        }
        
        /* スクロールインジケーター */
        .marker-placement-container::after {
          content: '← スワイプで横スクロール →';
          display: block;
          text-align: center;
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 8px;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  return null;
};

/**
 * フレームコントロールの修正
 */
export const FrameControlsFix: React.FC = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        /* フレームコントロールのコンテナ */
        .frame-controls-container {
          position: fixed !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          background: white !important;
          border-top: 2px solid #e5e7eb !important;
          padding: 8px !important;
          z-index: 999 !important;
          display: flex !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
          gap: 4px !important;
        }
        
        /* コントロールボタン */
        .frame-controls-container button {
          flex: 0 0 auto !important;
          padding: 8px 10px !important;
          font-size: 0.75rem !important;
          min-width: 45px !important;
        }
        
        /* スライダー */
        .frame-slider {
          width: 100% !important;
          margin: 8px 0 !important;
        }
        
        /* 再生速度セレクト */
        .playback-speed {
          font-size: 0.75rem !important;
          padding: 6px !important;
        }
        
        /* メインコンテンツの下部余白 */
        .wizard-main {
          padding-bottom: 100px !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  return null;
};

/**
 * すべてのモバイル修正を適用
 */
export const ApplyAllMobileFixes: React.FC = () => {
  return (
    <>
      <MobileResponsiveFix />
      <MobileHeaderFix />
      <MarkerTableFix />
      <FrameControlsFix />
    </>
  );
};

export default ApplyAllMobileFixes;