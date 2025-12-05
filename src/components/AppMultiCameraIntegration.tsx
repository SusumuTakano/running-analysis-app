/**
 * App.tsx に追加する最小限の変更を記述したコンポーネント
 * このファイルは実際には使用せず、App.tsxへの差分として適用する
 */

import React from 'react';
import MultiCameraRunSetup from './MultiCameraRunSetup';
import { Run, RunSegment } from '../types/multiCamera';
import { combineSegmentSteps, calculateMultiCameraStats } from '../utils/multiCameraUtils';

// App.tsxの先頭付近（import文の後）に追加する型定義
type AnalysisMode = 'single' | 'multi' | 'panning'; // panningは非表示だがコード保持

// App.tsx内のコンポーネント内で追加する state
export const MultiCameraStates = () => {
  // 解析モード（single=シングル固定カメラ、multi=マルチ固定カメラ）
  const [analysisMode, setAnalysisMode] = React.useState<AnalysisMode>('single');
  
  // マルチカメラ用のデータ
  const [currentRun, setCurrentRun] = React.useState<Run | null>(null);
  const [runSegments, setRunSegments] = React.useState<RunSegment[]>([]);
  const [isMultiCameraSetup, setIsMultiCameraSetup] = React.useState(false);
  
  return { analysisMode, setAnalysisMode, currentRun, setCurrentRun, runSegments, setRunSegments, isMultiCameraSetup, setIsMultiCameraSetup };
};

// renderStepContent内のcase 0に追加する条件分岐
export const RenderModeSelection = ({ 
  analysisMode, 
  setAnalysisMode,
  setIsMultiCameraSetup,
  setWizardStep 
}: any) => {
  // 既存のStep 0の最後（「次へ」ボタンの前）に、モード選択を追加
  return (
    <>
      {/* 解析モード選択（測定者情報の後に追加） */}
      <div style={{
        maxWidth: "600px",
        margin: "24px auto",
        background: "white",
        padding: "32px",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 'bold' }}>
          解析モードを選択
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: analysisMode === 'single' ? '#3b82f6' : '#f3f4f6',
            color: analysisMode === 'single' ? 'white' : '#374151',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}>
            <input
              type="radio"
              name="analysisMode"
              value="single"
              checked={analysisMode === 'single'}
              onChange={() => setAnalysisMode('single')}
              style={{ display: 'none' }}
            />
            📹 シングル固定カメラ
          </label>
          
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: analysisMode === 'multi' ? '#3b82f6' : '#f3f4f6',
            color: analysisMode === 'multi' ? 'white' : '#374151',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}>
            <input
              type="radio"
              name="analysisMode"
              value="multi"
              checked={analysisMode === 'multi'}
              onChange={() => setAnalysisMode('multi')}
              style={{ display: 'none' }}
            />
            📹📹 マルチ固定カメラ（10mごと）
          </label>
          
          {/* パンカメラモードは非表示（コードは残す） */}
          {false && (
            <label style={{ display: 'none' }}>
              <input
                type="radio"
                name="analysisMode"
                value="panning"
                checked={analysisMode === 'panning'}
                onChange={() => setAnalysisMode('panning')}
              />
              パンカメラ
            </label>
          )}
        </div>
        
        {analysisMode === 'multi' && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#fef3c7',
            borderRadius: '8px',
            fontSize: '0.9rem'
          }}>
            ⚠️ マルチカメラモードでは、10mごとに複数の動画を撮影し、
            それらを結合して1本の走行データとして解析します。
          </div>
        )}
      </div>
    </>
  );
};

// handleMultiCameraStart関数（App.tsx内に追加）
export const handleMultiCameraStart = async (
  run: Run, 
  segments: RunSegment[],
  setCurrentRun: any,
  setRunSegments: any,
  setWizardStep: any
) => {
  console.log('マルチカメラ解析開始:', { run, segments });
  
  setCurrentRun(run);
  setRunSegments(segments);
  
  // セグメントごとの解析処理を実行
  for (const segment of segments) {
    console.log(`セグメント${segment.segmentIndex}を解析中...`);
    // ここで既存の固定カメラ解析ロジックを呼び出す
    // processVideoForSegment(segment);
  }
  
  // 結果表示画面へ遷移
  setWizardStep(6);
};

// renderStepContent内でマルチカメラモードの場合の分岐
export const RenderMultiCameraContent = ({
  isMultiCameraSetup,
  athleteInfo,
  currentRun,
  runSegments,
  handleMultiCameraStart,
  setIsMultiCameraSetup
}: any) => {
  if (!isMultiCameraSetup) return null;
  
  return (
    <MultiCameraRunSetup
      athleteId={athleteInfo?.name} // 仮のID
      onStartAnalysis={handleMultiCameraStart}
      onCancel={() => setIsMultiCameraSetup(false)}
      processSegmentVideo={async (video: File, segment: RunSegment) => {
        // 既存の解析ロジックを呼び出す
        console.log(`Processing segment ${segment.segmentIndex} with video:`, video.name);
        // TODO: 実際の解析処理を実装
        return `session_${segment.id}`;
      }}
    />
  );
};

export default function AppMultiCameraIntegration() {
  return null; // このファイルは実行されない
}