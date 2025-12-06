import React, { useEffect } from 'react';

/**
 * モバイルでの表示をシンプル化
 * - マルチカメラモードを非表示
 * - 不要な要素を削除
 */
export const MobileSimplifier: React.FC = () => {
  useEffect(() => {
    const simplifyForMobile = () => {
      const isMobile = window.innerWidth <= 768;
      if (!isMobile) return;

      // スタイルを追加
      const styleId = 'mobile-simplifier-styles';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement;
      
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      styleElement.textContent = `
        /* モバイルでマルチカメラモードを非表示 */
        @media (max-width: 768px) {
          /* マルチカメラモード選択を非表示 */
          label:has(input[value="multi"]) {
            display: none !important;
          }
          
          /* 解析モード選択セクション全体を非表示（シングルのみなら） */
          div:has(> h3:contains("解析モードを選択")) {
            display: none !important;
          }
          
          /* ヘッダーをシンプル化 */
          .app-header-new {
            position: relative !important;
            padding: 10px !important;
            height: auto !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          }
          
          .app-title-new {
            font-size: 1.2rem !important;
            line-height: 1.3 !important;
            margin: 0 !important;
          }
          
          .app-subtitle-new {
            font-size: 0.75rem !important;
            line-height: 1.2 !important;
            margin: 2px 0 0 0 !important;
          }
          
          /* ボタンをコンパクトに */
          .app-header-new button {
            font-size: 0.75rem !important;
            padding: 6px 10px !important;
            height: 32px !important;
          }
          
          /* Step 5 マーカーページの修正 */
          .wizard-step-5 table,
          .wizard-step-5 .table-container {
            display: block !important;
            width: 100% !important;
            overflow-x: auto !important;
            overflow-y: visible !important;
            -webkit-overflow-scrolling: touch !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .wizard-step-5 table {
            min-width: 600px !important;
            border-collapse: collapse !important;
          }
          
          .wizard-step-5 table th,
          .wizard-step-5 table td {
            padding: 8px 5px !important;
            font-size: 11px !important;
            white-space: nowrap !important;
            border: 1px solid #ddd !important;
            vertical-align: middle !important;
            background: white !important;
            position: relative !important;
            z-index: 1 !important;
          }
          
          .wizard-step-5 table input[type="number"] {
            width: 45px !important;
            max-width: 45px !important;
            padding: 3px 2px !important;
            font-size: 12px !important;
            margin: 0 !important;
            border: 1px solid #999 !important;
            background: white !important;
          }
          
          .wizard-step-5 table button {
            padding: 4px 6px !important;
            font-size: 10px !important;
            min-height: 26px !important;
            margin: 2px !important;
            white-space: nowrap !important;
          }
          
          /* マーカーテーブルのスクロールヒント */
          .wizard-step-5::after {
            content: "← 左右にスワイプしてスクロール →";
            display: block;
            text-align: center;
            font-size: 11px;
            color: #666;
            padding: 8px;
            background: #f5f5f5;
            position: fixed;
            bottom: 60px;
            left: 10px;
            right: 10px;
            border-radius: 5px;
            z-index: 100;
          }
          
          /* メインコンテンツの余白調整 */
          .wizard-main {
            padding: 10px !important;
            margin-top: 10px !important;
          }
          
          /* フォーム要素 */
          input, select, textarea {
            font-size: 16px !important; /* iOSズーム防止 */
          }
          
          /* ボタンの最小サイズ */
          button {
            min-height: 40px !important;
            touch-action: manipulation !important;
          }
          
          /* ステップインジケーター */
          .step-progress {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          
          /* 不要な余白を削除 */
          .wizard-content {
            padding: 15px !important;
          }
          
          /* ナビゲーションボタン */
          .wizard-nav {
            padding: 10px !important;
          }
          
          .wizard-nav button {
            width: 100% !important;
            margin: 5px 0 !important;
          }
        }
      `;
    };

    simplifyForMobile();
    window.addEventListener('resize', simplifyForMobile);
    
    return () => {
      window.removeEventListener('resize', simplifyForMobile);
    };
  }, []);

  return null;
};

export default MobileSimplifier;