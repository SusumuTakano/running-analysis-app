// src/components/MobileHeader.tsx
import React from "react";

/**
 * 以前はモバイル専用の紫ヘッダー（🏃ランニング分析＋ハンバーガー）を表示していたコンポーネント。
 * 現在は上部の共通ヘッダーで代替できているため、モバイルヘッダーの出力を止める。
 * 既存の呼び出し側との互換性のために props は受け取るが一切使わない。
 */
interface MobileHeaderProps {
  userProfile?: { name: string };
  onNewAnalysis?: () => void;
  onShowTutorial?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = () => {
  // 何も描画しない
  return null;
};

export default MobileHeader;
