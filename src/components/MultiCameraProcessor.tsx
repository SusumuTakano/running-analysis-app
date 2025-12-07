/**
 * Multi-Camera Processor Component
 * Orchestrates the analysis of multiple segments and displays results
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { 
  Run, 
  RunSegment, 
  SegmentAnalysisResult,
  RunAnalysisResult 
} from '../types/multiCameraTypes';
import { analyzeSegment, mergeSegments } from '../utils/multiCameraAnalysis';

interface MultiCameraProcessorProps {
  run: Run;
  segments: RunSegment[];
  onSegmentAnalysis: (videoFile: File) => Promise<any>; // Existing analysis logic
  onComplete: (result: RunAnalysisResult) => void;
  onCancel: () => void;
}

export const MultiCameraProcessor: React.FC<MultiCameraProcessorProps> = ({
  run,
  segments,
  onSegmentAnalysis,
  onComplete,
  onCancel
}) => {
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [segmentResults, setSegmentResults] = useState<Map<string, SegmentAnalysisResult>>(new Map());
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Process segments sequentially
  const processNextSegment = useCallback(async () => {
    console.log(`processNextSegment called: index=${currentSegmentIndex}, total=${segments.length}`);
    
    if (currentSegmentIndex >= segments.length) {
      // All segments processed - merge results
      console.log('All segments processed, merging results...');
      const results = Array.from(segmentResults.values());
      console.log(`Results count: ${results.length}, Expected: ${segments.length}`);
      
      if (results.length === segments.length) {
        console.log('Calling mergeSegments...');
        const mergedResult = mergeSegments(run, segments, results);
        console.log('Merged result:', mergedResult);
        onComplete(mergedResult);
        setProcessingStatus('completed');
      } else {
        console.warn('Results count mismatch!');
      }
      return;
    }

    const segment = segments[currentSegmentIndex];
    if (!segment.videoFile) {
      setErrorMessage(`Segment ${currentSegmentIndex + 1} has no video file`);
      setProcessingStatus('error');
      return;
    }

    setProcessingStatus('processing');
    
    try {
      console.log(`🎬 Processing segment ${currentSegmentIndex + 1}/${segments.length}`);
      
      // Analyze this segment using existing logic
      const result = await analyzeSegment(
        segment.videoFile,
        segment,
        onSegmentAnalysis
      );
      
      // Store result
      console.log(`Storing result for segment ${segment.id}:`, result);
      setSegmentResults(prev => {
        const newMap = new Map(prev);
        newMap.set(segment.id, result);
        console.log(`Updated results map size: ${newMap.size}`);
        return newMap;
      });
      
      // Move to next segment
      setCurrentSegmentIndex(prev => prev + 1);
      
    } catch (error) {
      console.error(`Error processing segment ${currentSegmentIndex + 1}:`, error);
      setErrorMessage(`セグメント ${currentSegmentIndex + 1} の処理中にエラーが発生しました`);
      setProcessingStatus('error');
    }
  }, [currentSegmentIndex, segments, run, segmentResults, onSegmentAnalysis, onComplete]);

  // Start processing when component mounts
  useEffect(() => {
    if (processingStatus === 'idle' && segments.length > 0) {
      processNextSegment();
    }
  }, []);

  // Continue processing when segment index changes
  useEffect(() => {
    if (processingStatus === 'processing') {
      if (currentSegmentIndex < segments.length) {
        // Add a small delay to allow UI to update
        const timer = setTimeout(() => {
          processNextSegment();
        }, 100);
        return () => clearTimeout(timer);
      } else if (currentSegmentIndex === segments.length) {
        // All segments processed - trigger completion
        processNextSegment();
      }
    }
  }, [currentSegmentIndex, processingStatus, processNextSegment]);

  // Calculate progress
  const progress = (currentSegmentIndex / segments.length) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">マルチカメラ解析処理中</h2>
        
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>進行状況</span>
            <span>{currentSegmentIndex}/{segments.length} セグメント</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Segment status list */}
        <div className="space-y-3 mb-6">
          {segments.map((segment, idx) => {
            const result = segmentResults.get(segment.id);
            const isProcessing = idx === currentSegmentIndex && processingStatus === 'processing';
            const isCompleted = result !== undefined;
            const isPending = idx > currentSegmentIndex;
            
            return (
              <div 
                key={segment.id}
                className={`p-4 rounded-lg border ${
                  isProcessing ? 'border-blue-500 bg-blue-50' :
                  isCompleted ? 'border-green-500 bg-green-50' :
                  'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {isProcessing && <Loader className="w-5 h-5 mr-3 animate-spin text-blue-500" />}
                    {isCompleted && <CheckCircle className="w-5 h-5 mr-3 text-green-500" />}
                    {isPending && <div className="w-5 h-5 mr-3 rounded-full border-2 border-gray-300" />}
                    
                    <div>
                      <div className="font-medium">
                        セグメント {idx + 1}: {segment.startDistanceM}〜{segment.endDistanceM}m
                      </div>
                      {result && (
                        <div className="text-sm text-gray-600 mt-1">
                          検出ステップ数: {result.summary.totalSteps} | 
                          平均速度: {result.summary.avgSpeed.toFixed(2)}m/s | 
                          姿勢認識率: {result.metadata.poseSuccessRate.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm">
                    {isProcessing && <span className="text-blue-600">処理中...</span>}
                    {isCompleted && <span className="text-green-600">完了</span>}
                    {isPending && <span className="text-gray-400">待機中</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current processing details */}
        {processingStatus === 'processing' && currentSegmentIndex < segments.length && (
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium mb-2">現在の処理内容</h3>
            <ul className="text-sm space-y-1 text-gray-600">
              <li>• フレーム抽出中...</li>
              <li>• 姿勢推定実行中...</li>
              <li>• ステップ検出中...</li>
              <li>• メトリクス計算中...</li>
            </ul>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="bg-red-50 p-4 rounded-lg mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-red-800">エラーが発生しました</div>
              <div className="text-sm text-red-600 mt-1">{errorMessage}</div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {processingStatus === 'error' && (
            <>
              <button
                onClick={onCancel}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setProcessingStatus('processing');
                  processNextSegment();
                }}
                className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                再試行
              </button>
            </>
          )}
          
          {processingStatus === 'processing' && (
            <button
              onClick={onCancel}
              className="w-full px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              処理を中断
            </button>
          )}
          
          {processingStatus === 'completed' && (
            <div className="w-full text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <div className="text-lg font-medium text-green-700">
                全セグメントの解析が完了しました！
              </div>
              <div className="text-sm text-gray-600 mt-1">
                結果画面に自動的に移動します...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiCameraProcessor;