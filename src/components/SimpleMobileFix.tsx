import React, { useEffect } from 'react';

/**
 * シンプルで安全なモバイル修正
 * 最小限の変更のみを適用
 */
export const SimpleMobileFix: React.FC = () => {
  useEffect(() => {
    // モバイルかどうかの判定
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    // スタイルタグを追加（CSSのみ、JSでの操作は最小限）
    const styleId = 'simple-mobile-fix-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    // シンプルで安全なCSS修正のみ
    styleElement.textContent = `
      /* ベースの修正 - スクロール可能にする */
      @media (max-width: 768px) {
        html, body {
          overflow-x: hidden;
          overflow-y: auto;
          height: auto;
          width: 100%;
        }

        .app-container {
          width: 100%;
          padding: 10px;
          overflow: visible;
        }

        /* ヘッダーをシンプルに修正 */
        .app-header-new {
          position: relative;
          width: 100%;
          padding: 10px;
          margin-bottom: 10px;
        }

        .app-title-new {
          font-size: 1.2rem;
          word-break: break-word;
        }

        .app-subtitle-new {
          font-size: 0.8rem;
          word-break: break-word;
        }

        /* ステップインジケーター */
        .step-progress {
          display: flex;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding: 10px 0;
        }

        .step-item {
          flex: 0 0 auto;
          min-width: 60px;
        }

        /* テーブルの横スクロール対応 */
        .table-container,
        .wizard-content table {
          display: block;
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ボタンサイズ調整 */
        button {
          min-height: 44px; /* iOSのタップ可能最小サイズ */
        }

        /* 入力フィールド - ズーム防止 */
        input, select, textarea {
          font-size: 16px;
        }

        /* メインコンテンツの余白 */
        .wizard-main {
          padding: 10px;
        }
      }
    `;

    // ビューポート設定（最小限）
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');

    // クリーンアップ
    return () => {
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, []);

  return null;
};

export default SimpleMobileFix;