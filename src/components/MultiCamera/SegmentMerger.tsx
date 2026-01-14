/**
 * SegmentMerger Component
 * Visualizes and allows interactive editing of merged segments
 */

import React, { useState } from 'react';
import { MergedAnalysisResult, StepData, BoundaryStepGroup } from './types';

interface SegmentMergerProps {
  mergedResult: MergedAnalysisResult;
  onComplete: (result: MergedAnalysisResult) => void;
  onBack: () => void;
}

export const SegmentMerger: React.FC<SegmentMergerProps> = ({
  mergedResult,
  onComplete,
  onBack,
}) => {
  const [selectedBoundary, setSelectedBoundary] = useState<number | null>(null);
  
  const renderStepTimeline = () => {
    const steps = mergedResult.allSteps;
    const maxDistance = mergedResult.summary.totalDistanceM;
    
    return (
      <div style={{ marginTop: '30px' }}>
        <h3>ステップタイムライン</h3>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            padding: '10px',
          }}
        >
          {/* Distance markers */}
          {[0, 5, 10, 15].map(dist => (
            <div
              key={dist}
              style={{
                position: 'absolute',
                left: `${(dist / maxDistance) * 100}%`,
                top: '0',
                bottom: '0',
                borderLeft: '2px dashed #999',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '-20px',
                  left: '-10px',
                  fontSize: '12px',
                  color: '#666',
                }}
              >
                {dist}m
              </span>
            </div>
          ))}
          
          {/* Steps */}
          {steps.map((step, idx) => (
            <div
              key={step.stepId}
              style={{
                position: 'absolute',
                left: `${(step.distanceAtContactM / maxDistance) * 100}%`,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: step.isInterpolated
                  ? '#FFA500'
                  : step.quality === 'warning'
                  ? '#FF6B6B'
                  : '#4CAF50',
                border: '2px solid white',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
              title={`Step ${idx + 1}: ${step.distanceAtContactM.toFixed(2)}m${
                step.isInterpolated ? ' (補間)' : ''
              }`}
            />
          ))}
        </div>
        
        <div style={{ marginTop: '10px', fontSize: '12px' }}>
          <span style={{ marginRight: '20px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#4CAF50',
                marginRight: '5px',
              }}
            />
            実測ステップ
          </span>
          <span style={{ marginRight: '20px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#FFA500',
                marginRight: '5px',
              }}
            />
            補間ステップ
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#FF6B6B',
                marginRight: '5px',
              }}
            />
            異常値
          </span>
        </div>
      </div>
    );
  };
  
  const renderBoundaries = () => {
    if (mergedResult.boundaries.length === 0) {
      return (
        <div style={{ marginTop: '20px' }}>
          <p>境界での重複は検出されませんでした。</p>
        </div>
      );
    }
    
    return (
      <div style={{ marginTop: '30px' }}>
        <h3>セグメント境界の重複処理</h3>
        {mergedResult.boundaries.map((boundary, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: '15px',
              padding: '15px',
              backgroundColor: selectedBoundary === idx ? '#e3f2fd' : '#f9f9f9',
              borderRadius: '4px',
              border: selectedBoundary === idx ? '2px solid #2196F3' : '1px solid #ddd',
              cursor: 'pointer',
            }}
            onClick={() => setSelectedBoundary(idx)}
          >
            <h4 style={{ margin: '0 0 10px 0' }}>
              境界 {boundary.boundaryPositionM.toFixed(1)}m
            </h4>
            <p style={{ margin: '5px 0' }}>
              検出されたステップ: {boundary.steps.length}個
            </p>
            <p style={{ margin: '5px 0', color: '#4CAF50' }}>
              ✅ 採用: {boundary.selectedStep?.distanceAtContactM.toFixed(3)}m
            </p>
            {boundary.duplicates.length > 0 && (
              <p style={{ margin: '5px 0', color: '#FF6B6B' }}>
                ❌ 除外: {boundary.duplicates.map(d => d.distanceAtContactM.toFixed(3) + 'm').join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };
  
  const renderSummary = () => {
    const summary = mergedResult.summary;
    
    return (
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>統合結果サマリー</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
          <div>
            <p><strong>総距離:</strong> {summary.totalDistanceM.toFixed(2)}m</p>
            <p><strong>総ステップ数:</strong> {summary.totalSteps}</p>
            <p><strong>実測ステップ:</strong> {summary.realSteps}</p>
            <p><strong>補間ステップ:</strong> {summary.interpolatedSteps}</p>
          </div>
          <div>
            <p><strong>平均ストライド:</strong> {summary.avgStrideM.toFixed(3)}m</p>
            <p><strong>中央値ストライド:</strong> {summary.medianStrideM.toFixed(3)}m</p>
            <p><strong>平均速度:</strong> {summary.avgSpeedMps.toFixed(2)}m/s</p>
            <p><strong>平均ケイデンス:</strong> {summary.avgCadence.toFixed(1)} steps/min</p>
          </div>
        </div>
      </div>
    );
  };
  
  const renderWarnings = () => {
    if (mergedResult.warnings.length === 0) {
      return null;
    }
    
    return (
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
        <h3 style={{ marginTop: '0', color: '#856404' }}>⚠️ 警告</h3>
        <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
          {mergedResult.warnings.map((warning, idx) => (
            <li key={idx} style={{ marginBottom: '5px', color: '#856404' }}>
              [{warning.type}] {warning.message}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  const renderStepTable = () => {
    const steps = mergedResult.allSteps.slice(0, 20); // Show first 20 steps
    
    return (
      <div style={{ marginTop: '30px' }}>
        <h3>ステップ詳細（最初の20ステップ）</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>#</th>
                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>距離 (m)</th>
                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>ストライド (m)</th>
                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>速度 (m/s)</th>
                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>品質</th>
                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>補間</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, idx) => (
                <tr key={step.stepId}>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{idx + 1}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                    {step.distanceAtContactM.toFixed(3)}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                    {step.strideM !== null ? step.strideM.toFixed(3) : '-'}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                    {step.speedMps !== null ? step.speedMps.toFixed(2) : '-'}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #ddd',
                      textAlign: 'center',
                      color: step.quality === 'good' ? '#4CAF50' : '#FF6B6B',
                    }}
                  >
                    {step.quality === 'good' ? '✓' : '⚠'}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                    {step.isInterpolated ? '●' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mergedResult.allSteps.length > 20 && (
          <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            ...および他 {mergedResult.allSteps.length - 20} ステップ
          </p>
        )}
      </div>
    );
  };
  
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>セグメント統合結果</h2>
      
      {renderSummary()}
      {renderStepTimeline()}
      {renderBoundaries()}
      {renderWarnings()}
      {renderStepTable()}
      
      <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => onComplete(mergedResult)}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            flex: 1,
          }}
        >
          ✅ 結果を確定
        </button>
        <button
          onClick={onBack}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            flex: 1,
          }}
        >
          ← セグメント解析に戻る
        </button>
      </div>
    </div>
  );
};
