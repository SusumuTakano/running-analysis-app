/**
 * MultiCameraAnalysis Component
 * Main orchestrator for multi-camera segment analysis
 */

import React, { useState, useCallback } from 'react';
import {
  MultiCameraState,
  SegmentRawData,
  SegmentAnalysisResult,
  MergedAnalysisResult,
} from './types';
import { SegmentAnalyzer } from './SegmentAnalyzer';
import { SegmentMerger } from './SegmentMerger';
import { mergeSegments } from '../../utils/multiCamera/multiCameraCore';

interface MultiCameraAnalysisProps {
  runId: string;
  totalDistanceM: number;
  segmentLengthM: number;
  segments: SegmentRawData[];
  onComplete: (result: MergedAnalysisResult) => void;
  onCancel: () => void;
}

export const MultiCameraAnalysis: React.FC<MultiCameraAnalysisProps> = ({
  runId,
  totalDistanceM,
  segmentLengthM,
  segments,
  onComplete,
  onCancel,
}) => {
  const [state, setState] = useState<MultiCameraState>({
    runId,
    totalDistanceM,
    segmentLengthM,
    segments,
    currentSegmentIndex: 0,
    segmentResults: new Map(),
    mergedResult: null,
    status: 'analyzing',
    currentOperation: 'セグメント解析中...',
  });
  
  const currentSegment = segments[state.currentSegmentIndex];
  const isAllSegmentsAnalyzed = state.segmentResults.size === segments.length;
  
  // Handle segment analysis completion
  const handleSegmentAnalysisComplete = useCallback(
    (result: SegmentAnalysisResult) => {
      console.log(`✅ Segment ${result.segmentIndex + 1} analysis complete`);
      
      // Save result
      const newResults = new Map(state.segmentResults);
      newResults.set(result.segmentId, result);
      
      // Check if this was the last segment
      if (newResults.size === segments.length) {
        console.log('🎉 All segments analyzed! Starting merge...');
        
        // Merge all segments
        const segmentResultsArray = Array.from(newResults.values());
        const merged = mergeSegments(
          segmentResultsArray,
          totalDistanceM,
          segmentLengthM
        );
        
        setState(prev => ({
          ...prev,
          segmentResults: newResults,
          mergedResult: merged,
          status: 'merging',
          currentOperation: 'セグメント統合完了',
        }));
      } else {
        // Move to next segment
        const nextIndex = state.currentSegmentIndex + 1;
        setState(prev => ({
          ...prev,
          segmentResults: newResults,
          currentSegmentIndex: nextIndex,
          currentOperation: `セグメント ${nextIndex + 1} / ${segments.length} 解析中...`,
        }));
      }
    },
    [state, segments, totalDistanceM, segmentLengthM]
  );
  
  // Handle merge completion
  const handleMergeComplete = useCallback(
    (result: MergedAnalysisResult) => {
      console.log('✅ Merge complete! Finalizing...');
      setState(prev => ({
        ...prev,
        status: 'complete',
        currentOperation: '解析完了',
      }));
      onComplete(result);
    },
    [onComplete]
  );
  
  // Render progress indicator
  const renderProgress = () => {
    const completed = state.segmentResults.size;
    const total = segments.length;
    const progress = (completed / total) * 100;
    
    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>進捗: {state.currentOperation}</span>
          <span>{completed} / {total} セグメント完了</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '24px',
            backgroundColor: '#e0e0e0',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#4CAF50',
              transition: 'width 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            {progress.toFixed(0)}%
          </div>
        </div>
      </div>
    );
  };
  
  // Render segment list
  const renderSegmentList = () => {
    return (
      <div style={{ marginBottom: '20px' }}>
        <h3>セグメント一覧</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {segments.map((segment, idx) => {
            const isCompleted = state.segmentResults.has(segment.id);
            const isCurrent = idx === state.currentSegmentIndex;
            
            return (
              <div
                key={segment.id}
                style={{
                  padding: '15px',
                  borderRadius: '8px',
                  border: isCurrent ? '3px solid #2196F3' : '1px solid #ddd',
                  backgroundColor: isCompleted ? '#e8f5e9' : isCurrent ? '#e3f2fd' : '#f5f5f5',
                  minWidth: '150px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
                  セグメント {idx + 1}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {segment.startDistanceM}m - {segment.endDistanceM}m
                </div>
                <div style={{ fontSize: '24px', marginTop: '10px' }}>
                  {isCompleted ? '✅' : isCurrent ? '▶️' : '⏸️'}
                </div>
                {isCompleted && state.segmentResults.get(segment.id) && (
                  <div style={{ fontSize: '12px', marginTop: '5px', color: '#4CAF50' }}>
                    {state.segmentResults.get(segment.id)!.steps.length} ステップ
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Main render
  if (state.status === 'merging' && state.mergedResult) {
    return (
      <SegmentMerger
        mergedResult={state.mergedResult}
        onComplete={handleMergeComplete}
        onBack={() => {
          // Allow going back to re-analyze a segment
          setState(prev => ({
            ...prev,
            status: 'analyzing',
            mergedResult: null,
          }));
        }}
      />
    );
  }
  
  if (state.status === 'analyzing' && currentSegment) {
    return (
      <div style={{ padding: '20px' }}>
        {renderProgress()}
        {renderSegmentList()}
        
        <div style={{ borderTop: '2px solid #ddd', paddingTop: '20px' }}>
          <SegmentAnalyzer
            key={currentSegment.id} // 🔧 FIX: Force remount on segment change
            segment={currentSegment}
            onAnalysisComplete={handleSegmentAnalysisComplete}
            onCancel={onCancel}
          />
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>マルチカメラ解析</h2>
      <p>状態: {state.status}</p>
      <p>操作: {state.currentOperation}</p>
    </div>
  );
};
