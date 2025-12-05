/**
 * モバイルレスポンシブ対応のためのスタイル修正コンポーネント
 * App.tsxに適用する修正内容をまとめたもの
 */

import React from 'react';

export const mobileStyles = {
  // モバイル用ヘッダースタイル
  mobileHeader: (isMobile: boolean) => ({
    ...(isMobile ? {
      position: 'sticky' as const,
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1001,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '8px 10px',
      margin: 0,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    } : {}),
  }),
  
  // モバイル用タイトルスタイル
  mobileTitle: (isMobile: boolean) => ({
    fontSize: isMobile ? '1.1rem' : '2.5rem',
    fontWeight: 700,
    marginBottom: isMobile ? 0 : 8,
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    whiteSpace: isMobile ? 'normal' as const : 'nowrap' as const,
    wordBreak: 'keep-all' as const,
  }),
  
  // モバイル用サブタイトルスタイル
  mobileSubtitle: (isMobile: boolean) => ({
    display: isMobile ? 'none' : 'block',
    fontSize: '1rem',
    opacity: 0.9,
  }),
  
  // モバイル用フレームナビゲーション
  mobileFrameNav: (isMobile: boolean) => ({
    position: isMobile ? 'relative' as const : 'fixed' as const,
    bottom: isMobile ? 'auto' : '20px',
    left: isMobile ? 'auto' : '50%',
    transform: isMobile ? 'none' : 'translateX(-50%)',
    width: isMobile ? '100%' : 'auto',
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'white',
    padding: isMobile ? '10px' : '12px 20px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 1000,
    margin: isMobile ? '10px 0' : 0,
  }),
  
  // モバイル用マーカーボタン
  mobileMarkerButton: (isMobile: boolean) => ({
    padding: isMobile ? '8px 12px' : '10px 20px',
    fontSize: isMobile ? '0.85rem' : '1rem',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: isMobile ? '60px' : '80px',
    whiteSpace: 'nowrap' as const,
  }),
  
  // モバイル用キャンバスエリア
  mobileCanvas: (isMobile: boolean) => ({
    maxWidth: '100%',
    overflow: 'auto',
    margin: isMobile ? '10px 0' : '20px 0',
    touchAction: 'pan-x pan-y' as const,
  }),
  
  // モバイル用コンテナ
  mobileContainer: (isMobile: boolean) => ({
    padding: isMobile ? '10px' : '20px',
    paddingTop: isMobile ? '70px' : '20px',
    maxWidth: '100%',
    overflow: 'hidden',
  }),
  
  // モバイル用ウィザードコンテンツ
  mobileWizardContent: (isMobile: boolean) => ({
    padding: isMobile ? '12px' : '20px',
    maxWidth: '100%',
  }),
  
  // モバイル用ステップインジケーター
  mobileStepIndicator: (isMobile: boolean) => ({
    padding: isMobile ? '8px' : '16px',
    gap: isMobile ? '4px' : '8px',
    marginBottom: isMobile ? '16px' : '32px',
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  }),
  
  // モバイル用ボタングループ
  mobileButtonGroup: (isMobile: boolean) => ({
    display: isMobile ? 'flex' : 'flex',
    flexDirection: isMobile ? 'column' as const : 'row' as const,
    gap: isMobile ? '8px' : '12px',
    width: '100%',
    padding: isMobile ? '10px' : '20px',
  }),
  
  // モバイル用フレーム操作ボタン配置
  mobileFrameControls: (isMobile: boolean) => ({
    display: 'grid',
    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
    gap: '8px',
    margin: '10px 0',
    width: '100%',
  }),
};

// ヘルパー関数：モバイルデバイス判定
export const checkMobileDevice = () => {
  const ua = navigator.userAgent;
  const width = window.innerWidth;
  return /iPhone|iPad|iPod|Android/i.test(ua) || width < 768;
};

// ヘルパー関数：タブレット判定
export const checkTabletDevice = () => {
  const width = window.innerWidth;
  return width >= 768 && width < 1024;
};

// モバイル用のレイアウト調整を行うラッパーコンポーネント
export const MobileResponsiveWrapper: React.FC<{ 
  children: React.ReactNode;
  isMobile: boolean;
}> = ({ children, isMobile }) => {
  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      paddingBottom: isMobile ? '60px' : '0', // モバイルでは下部に余白を確保
    }}>
      {children}
    </div>
  );
};

export default mobileStyles;