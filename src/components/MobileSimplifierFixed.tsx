import React, { useEffect } from 'react';

export const MobileSimplifierFixed: React.FC = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'mobile-simplifier-fixed';
    style.textContent = `
      @media (max-width: 768px) {
        /* 既存のヘッダーを完全に削除 */
        .app-header-new {
          display: none !important;
        }
        
        /* ヘッダー分の余白調整 */
        .app-container {
          padding-top: 45px !important;
        }
        
        .wizard-main {
          margin-top: 0 !important;
          padding: 10px !important;
        }
        
        .step-progress {
          position: sticky !important;
          top: 40px !important;
          background: white !important;
          z-index: 100 !important;
          margin: 0 !important;
          padding: 8px 0 !important;
        }
        
        /* マルチカメラ選択を非表示 */
        label[style*="multi"] {
          display: none !important;
        }
        
        /* タイトル・サブタイトルを小さく */
        .app-title-new {
          font-size: 0 !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .app-subtitle-new {
          font-size: 0 !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Step 5,6 マーカーテーブルの修正 */
        .wizard-step-5 table,
        .wizard-step-6 table {
          display: block !important;
          width: 100% !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
        
        .wizard-step-5 table,
        .wizard-step-6 table {
          min-width: 500px !important;
        }
        
        .wizard-step-5 th,
        .wizard-step-5 td,
        .wizard-step-6 th,
        .wizard-step-6 td {
          padding: 6px 4px !important;
          font-size: 11px !important;
          white-space: nowrap !important;
        }
        
        .wizard-step-5 input[type="number"],
        .wizard-step-6 input[type="number"] {
          width: 40px !important;
          padding: 2px !important;
          font-size: 12px !important;
        }
        
        .wizard-step-5 button,
        .wizard-step-6 button {
          padding: 3px 5px !important;
          font-size: 10px !important;
          min-height: 24px !important;
        }
        
        /* フォーム要素のズーム防止 */
        input, select, textarea {
          font-size: 16px !important;
        }
        
        /* ボタンを押しやすく */
        button {
          min-height: 40px !important;
        }
        
        /* 小さいボタンは例外 */
        table button,
        .small-btn {
          min-height: 24px !important;
        }
      }
    `;
    
    if (!document.getElementById('mobile-simplifier-fixed')) {
      document.head.appendChild(style);
    }
    
    return () => {
      const existingStyle = document.getElementById('mobile-simplifier-fixed');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);
  
  return null;
};

export default MobileSimplifierFixed;