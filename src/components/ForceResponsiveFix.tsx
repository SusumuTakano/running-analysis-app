import React, { useEffect } from 'react';

/**
 * 強制的にモバイルレスポンシブを適用するコンポーネント
 * CSSが効かない場合の最終手段
 */
export const ForceResponsiveFix: React.FC = () => {
  useEffect(() => {
    const applyFixes = () => {
      const isMobile = window.innerWidth <= 768;
      
      if (!isMobile) return;

      // ヘッダーの強制修正
      const header = document.querySelector('.app-header-new') as HTMLElement;
      if (header) {
        header.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          height: auto !important;
          max-height: 100px !important;
          z-index: 9999 !important;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          padding: 8px 5px !important;
          margin: 0 !important;
          overflow: hidden !important;
          display: block !important;
        `;

        // ヘッダー内のdiv
        const headerDiv = header.querySelector('div') as HTMLElement;
        if (headerDiv) {
          headerDiv.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            width: 100% !important;
            gap: 4px !important;
          `;
        }
      }

      // タイトルの修正
      const title = document.querySelector('.app-title-new') as HTMLElement;
      if (title) {
        title.style.cssText = `
          font-size: 1.1rem !important;
          line-height: 1.2 !important;
          margin: 0 !important;
          padding: 2px 0 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        `;
      }

      // サブタイトルの修正
      const subtitle = document.querySelector('.app-subtitle-new') as HTMLElement;
      if (subtitle) {
        subtitle.style.cssText = `
          font-size: 0.65rem !important;
          line-height: 1.1 !important;
          margin: 0 !important;
          padding: 2px 0 !important;
          opacity: 0.9 !important;
        `;
      }

      // メインコンテンツの余白調整
      const main = document.querySelector('.wizard-main') as HTMLElement;
      if (main) {
        main.style.cssText = `
          margin-top: 100px !important;
          padding: 10px 5px 100px 5px !important;
          width: 100% !important;
        `;
      }

      // すべてのテーブルを修正
      const tables = document.querySelectorAll('table');
      tables.forEach((table) => {
        const parent = table.parentElement as HTMLElement;
        if (parent) {
          parent.style.cssText = `
            width: 100% !important;
            overflow-x: auto !important;
            overflow-y: visible !important;
            -webkit-overflow-scrolling: touch !important;
            position: relative !important;
          `;
        }

        (table as HTMLElement).style.cssText = `
          min-width: 500px !important;
          border-collapse: collapse !important;
        `;

        // テーブル内のセル
        const cells = table.querySelectorAll('th, td');
        cells.forEach((cell) => {
          (cell as HTMLElement).style.cssText = `
            padding: 6px 4px !important;
            font-size: 0.7rem !important;
            white-space: nowrap !important;
            vertical-align: middle !important;
            position: relative !important;
            background: white !important;
            border: 1px solid #ddd !important;
          `;
        });

        // テーブル内の入力フィールド
        const inputs = table.querySelectorAll('input[type="number"], input[type="text"]');
        inputs.forEach((input) => {
          (input as HTMLElement).style.cssText = `
            width: 45px !important;
            max-width: 45px !important;
            padding: 3px 2px !important;
            font-size: 0.7rem !important;
            margin: 0 !important;
            border: 1px solid #ccc !important;
          `;
        });

        // テーブル内のボタン
        const buttons = table.querySelectorAll('button');
        buttons.forEach((button) => {
          (button as HTMLElement).style.cssText = `
            padding: 3px 5px !important;
            font-size: 0.65rem !important;
            margin: 2px !important;
            white-space: nowrap !important;
            height: auto !important;
            line-height: 1.1 !important;
          `;
        });
      });

      // ステップインジケーターの修正
      const stepProgress = document.querySelector('.step-progress') as HTMLElement;
      if (stepProgress) {
        stepProgress.style.cssText = `
          display: flex !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
          padding: 8px 5px !important;
          gap: 5px !important;
          position: sticky !important;
          top: 100px !important;
          z-index: 100 !important;
          background: white !important;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1) !important;
        `;

        const stepItems = stepProgress.querySelectorAll('.step-item');
        stepItems.forEach((item) => {
          (item as HTMLElement).style.cssText = `
            flex: 0 0 auto !important;
            min-width: 55px !important;
          `;
        });
      }

      // フレームコントロールの修正
      const frameControls = document.querySelector('.frame-controls') as HTMLElement;
      if (frameControls) {
        frameControls.style.cssText = `
          position: fixed !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          background: white !important;
          border-top: 2px solid #333 !important;
          padding: 8px 5px !important;
          z-index: 9000 !important;
          display: flex !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
          gap: 5px !important;
        `;

        const controlButtons = frameControls.querySelectorAll('button');
        controlButtons.forEach((button) => {
          (button as HTMLElement).style.cssText = `
            flex: 0 0 auto !important;
            min-width: 40px !important;
            padding: 6px 8px !important;
            font-size: 0.7rem !important;
            height: 32px !important;
          `;
        });
      }

      // ビューポートメタタグの設定
      let viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        document.head.appendChild(viewport);
      }
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    };

    // 初回適用
    applyFixes();

    // DOM変更を監視
    const observer = new MutationObserver(() => {
      applyFixes();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    // リサイズ時も再適用
    window.addEventListener('resize', applyFixes);
    window.addEventListener('orientationchange', applyFixes);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', applyFixes);
      window.removeEventListener('orientationchange', applyFixes);
    };
  }, []);

  return null;
};

export default ForceResponsiveFix;