import { useEffect } from 'react';

export const MobileLayoutFix: React.FC = () => {
  useEffect(() => {
    const applyMobileFixes = () => {
      // 既存のスタイルタグを削除
      const existingStyle = document.getElementById('mobile-layout-fix-styles');
      if (existingStyle) {
        existingStyle.remove();
      }

      const style = document.createElement('style');
      style.id = 'mobile-layout-fix-styles';
      style.textContent = `
        @media (max-width: 768px) {
          /* マーカーテーブルの修正 */
          .marker-table,
          table {
            display: block !important;
            width: 100% !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            margin: 0 !important;
            position: relative !important;
          }
          
          .marker-table table,
          table tbody,
          table thead {
            min-width: 600px !important;
          }
          
          .marker-table td,
          .marker-table th,
          td, th {
            padding: 4px !important;
            font-size: 12px !important;
            white-space: nowrap !important;
          }
          
          .marker-table input,
          table input[type="number"],
          table input[type="text"] {
            width: 40px !important;
            max-width: 40px !important;
            padding: 2px !important;
            font-size: 16px !important; /* iOSのズームを防ぐ */
            height: 28px !important;
            border: 1px solid #ccc !important;
            box-sizing: border-box !important;
          }
          
          /* 重なり防止 */
          .marker-table tr,
          table tr {
            display: table-row !important;
            position: relative !important;
            z-index: 1 !important;
          }
          
          .marker-table td:first-child,
          table td:first-child {
            position: sticky !important;
            left: 0 !important;
            background: white !important;
            z-index: 2 !important;
          }
          
          /* ボタンの最適化 */
          button, .button, [type="button"] {
            min-height: 40px !important;
            min-width: 44px !important;
            padding: 8px 12px !important;
            font-size: 14px !important;
            touch-action: manipulation !important;
          }
          
          /* フレームコントロール */
          .frame-controls {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            background: white !important;
            padding: 5px !important;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1) !important;
            z-index: 100 !important;
            display: flex !important;
            gap: 5px !important;
            justify-content: center !important;
            flex-wrap: wrap !important;
          }
          
          .frame-controls button {
            flex: 0 0 auto !important;
            min-width: 60px !important;
            padding: 8px !important;
          }
          
          /* スクロールヒント */
          .scroll-hint {
            position: absolute !important;
            top: 50% !important;
            right: 10px !important;
            transform: translateY(-50%) !important;
            background: rgba(0,0,0,0.6) !important;
            color: white !important;
            padding: 5px 10px !important;
            border-radius: 15px !important;
            font-size: 11px !important;
            pointer-events: none !important;
            animation: fadeInOut 3s ease-in-out !important;
            z-index: 10 !important;
          }
          
          @keyframes fadeInOut {
            0%, 100% { opacity: 0; }
            10%, 90% { opacity: 1; }
          }
          
          /* 全体的なレイアウト調整 */
          body {
            overflow-x: hidden !important;
            -webkit-text-size-adjust: 100% !important;
          }
          
          .app-container {
            padding: 0 !important;
            margin-top: 45px !important;
            width: 100% !important;
            overflow-x: hidden !important;
          }
          
          .wizard-main {
            padding: 10px !important;
            margin: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          
          .step-content {
            padding: 10px !important;
            margin: 0 !important;
            overflow-x: hidden !important;
          }
          
          /* セレクトボックス */
          select {
            min-height: 40px !important;
            font-size: 16px !important; /* iOSのズームを防ぐ */
            padding: 8px !important;
            width: 100% !important;
            box-sizing: border-box !important;
            -webkit-appearance: none !important;
            appearance: none !important;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
            background-repeat: no-repeat !important;
            background-position: right 10px center !important;
            background-size: 20px !important;
            padding-right: 35px !important;
          }
          
          /* テキストエリア */
          textarea {
            font-size: 16px !important; /* iOSのズームを防ぐ */
            width: 100% !important;
            box-sizing: border-box !important;
          }
          
          /* モーダル */
          .modal, [class*="modal"] {
            position: fixed !important;
            top: 45px !important;
            left: 5px !important;
            right: 5px !important;
            bottom: 5px !important;
            width: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 10px !important;
            max-width: 100% !important;
            max-height: calc(100vh - 50px) !important;
            overflow-y: auto !important;
          }
        }
      `;
      document.head.appendChild(style);
      
      // 既存のマーカーテーブルにスクロールヒントを追加
      setTimeout(() => {
        if (window.innerWidth <= 768) {
          const tables = document.querySelectorAll('.marker-table, table');
          tables.forEach(table => {
            if (!table.querySelector('.scroll-hint')) {
              const hint = document.createElement('div');
              hint.className = 'scroll-hint';
              hint.textContent = '← 左右にスワイプ →';
              table.appendChild(hint);
            }
          });
        }
      }, 500);
    };

    // 即座に実行
    applyMobileFixes();
    
    // リサイズ時も再適用
    window.addEventListener('resize', applyMobileFixes);
    
    // DOMContentLoadedでも実行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyMobileFixes);
    }
    
    return () => {
      window.removeEventListener('resize', applyMobileFixes);
    };
  }, []);

  return null;
};

export default MobileLayoutFix;