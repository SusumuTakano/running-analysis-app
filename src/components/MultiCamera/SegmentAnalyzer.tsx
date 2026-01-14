/**
 * SegmentAnalyzer Component
 * Handles individual segment video analysis with frame extraction and pose estimation
 */

import React, { useState, useRef, useEffect } from 'react';
import { SegmentRawData, CalibrationData, FramePoseData } from './types';
import { analyzeSegment } from '../../utils/multiCamera/multiCameraCore';
import { extractFramesFromVideo } from '../../utils/videoProcessing';
import { runPoseEstimationOnFrames } from '../../utils/poseEstimation';

interface SegmentAnalyzerProps {
  segment: SegmentRawData;
  onAnalysisComplete: (result: any) => void;
  onCancel: () => void;
}

export const SegmentAnalyzer: React.FC<SegmentAnalyzerProps> = ({
  segment,
  onAnalysisComplete,
  onCancel,
}) => {
  const [status, setStatus] = useState<string>('準備中...');
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [contactMarks, setContactMarks] = useState<number[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [framesExtracted, setFramesExtracted] = useState(false);
  const [isPoseProcessing, setIsPoseProcessing] = useState(false);
  const [poseProgress, setPoseProgress] = useState(0);
  const [poseComplete, setPoseComplete] = useState(false);
  
  // Data refs
  const framesRef = useRef<ImageData[]>([]);
  const poseResultsRef = useRef<(FramePoseData | null)[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Auto-start frame extraction
  useEffect(() => {
    if (segment.videoFile && !isExtracting && !framesExtracted) {
      handleExtractFrames();
    }
  }, [segment.videoFile]);
  
  // Extract frames from video
  const handleExtractFrames = async () => {
    if (!segment.videoFile) {
      setStatus('❌ 動画ファイルがありません');
      return;
    }
    
    setIsExtracting(true);
    setStatus('フレーム抽出中...');
    
    try {
      const result = await extractFramesFromVideo(
        segment.videoFile,
        segment.fps || 120,
        (progress, statusText) => {
          setExtractionProgress(progress);
          setStatus(statusText);
        }
      );
      
      framesRef.current = result.frames;
      setTotalFrames(result.frames.length);
      setFramesExtracted(true);
      setStatus(`✅ ${result.frames.length}フレーム抽出完了。接地をマークしてください。`);
      
      console.log(`✅ Extracted ${result.frames.length} frames from ${segment.videoFile.name}`);
    } catch (error) {
      console.error('❌ Frame extraction error:', error);
      setStatus(`❌ フレーム抽出エラー: ${error}`);
    } finally {
      setIsExtracting(false);
    }
  };
  
  // Keyboard controls
  useEffect(() => {
    if (!framesExtracted) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleMarkContact();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentFrame(prev => Math.min(prev + 1, totalFrames - 1));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentFrame(prev => Math.max(prev - 1, 0));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [framesExtracted, totalFrames, contactMarks.length]); // 🔧 FIX: Add dependencies to ensure cleanup
  
  // Display current frame on canvas
  useEffect(() => {
    if (framesExtracted && canvasRef.current && framesRef.current[currentFrame]) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = framesRef.current[currentFrame];
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);
      }
    }
  }, [currentFrame, framesExtracted]);
  
  const handleMarkContact = () => {
    setContactMarks(prev => [...prev, currentFrame]);
    setStatus(`接地マーク: ${contactMarks.length + 1}回 (Frame ${currentFrame})`);
  };
  
  // 🆕 Run pose estimation
  const handleRunPoseEstimation = async () => {
    if (framesRef.current.length === 0) {
      setStatus('❌ フレームが抽出されていません');
      return;
    }
    
    setIsPoseProcessing(true);
    setPoseProgress(0);
    setStatus('姿勢推定を実行中...');
    
    try {
      const poseResults = await runPoseEstimationOnFrames(framesRef.current, {
        onProgress: (progress) => {
          setPoseProgress(progress);
        },
        onStatus: (statusText) => {
          setStatus(statusText);
        },
      });
      
      poseResultsRef.current = poseResults;
      setPoseComplete(true);
      
      const successCount = poseResults.filter(r => r !== null).length;
      setStatus(`✅ 姿勢推定完了: ${successCount}/${poseResults.length}フレーム検出`);
      
      console.log(`✅ Pose estimation complete: ${successCount}/${poseResults.length} frames`);
    } catch (error) {
      console.error('❌ Pose estimation error:', error);
      setStatus(`❌ 姿勢推定エラー: ${error}`);
    } finally {
      setIsPoseProcessing(false);
    }
  };
  
  const handleAnalyze = () => {
    // Create updated segment with extracted data
    const updatedSegment: SegmentRawData = {
      ...segment,
      frames: framesRef.current,
      poseResults: poseResultsRef.current,
      contactFrames: contactMarks,
      totalFrames: framesRef.current.length,
    };
    
    // Run analysis
    const result = analyzeSegment(updatedSegment);
    onAnalysisComplete(result);
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>セグメント {segment.segmentIndex + 1} 解析</h2>
      <p>範囲: {segment.startDistanceM}m - {segment.endDistanceM}m</p>
      
      {/* Progress during extraction */}
      {isExtracting && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ 
              width: '100%', 
              height: '30px', 
              backgroundColor: '#f0f0f0', 
              borderRadius: '15px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${extractionProgress}%`,
                height: '100%',
                backgroundColor: '#4CAF50',
                transition: 'width 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
              }}>
                {extractionProgress}%
              </div>
            </div>
          </div>
          <p>{status}</p>
        </div>
      )}
      
      {/* Frame viewer after extraction */}
      {framesExtracted && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <canvas
              ref={canvasRef}
              style={{ 
                width: '100%', 
                maxWidth: '960px',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
          </div>
          
          {/* Pose estimation button and progress */}
          {!poseComplete && (
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={handleRunPoseEstimation}
                disabled={isPoseProcessing}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  backgroundColor: isPoseProcessing ? '#ccc' : '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isPoseProcessing ? 'not-allowed' : 'pointer',
                  marginBottom: '10px',
                }}
              >
                {isPoseProcessing ? `姿勢推定中... ${poseProgress}%` : '姿勢推定を実行'}
              </button>
              
              {isPoseProcessing && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ 
                    width: '100%', 
                    height: '30px', 
                    backgroundColor: '#f0f0f0', 
                    borderRadius: '15px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${poseProgress}%`,
                      height: '100%',
                      backgroundColor: '#FF9800',
                      transition: 'width 0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                    }}>
                      {poseProgress}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {poseComplete && (
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
              ✅ 姿勢推定完了: {poseResultsRef.current.filter(r => r !== null).length}フレーム検出
            </div>
          )}
          
          <div style={{ marginBottom: '20px' }}>
            <p>ステータス: {status}</p>
            <p>現在のフレーム: {currentFrame} / {totalFrames}</p>
            <p>接地マーク: {contactMarks.length}回</p>
            
            {/* Frame slider */}
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={currentFrame}
              onChange={(e) => setCurrentFrame(Number(e.target.value))}
              style={{ width: '100%', marginTop: '10px' }}
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <button 
              onClick={handleMarkContact} 
              style={{ 
                marginRight: '10px',
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              接地をマーク (Space)
            </button>
          </div>
        </>
      )}
      
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={handleAnalyze}
          disabled={contactMarks.length < 3 || !segment.calibration || !poseComplete}
          style={{
            marginRight: '10px',
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: contactMarks.length >= 3 && segment.calibration && poseComplete ? '#4CAF50' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: contactMarks.length >= 3 && segment.calibration && poseComplete ? 'pointer' : 'not-allowed',
          }}
        >
          解析実行 ({contactMarks.length}ステップ)
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          キャンセル
        </button>
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p>操作方法:</p>
        <ul>
          <li>Step 1: 姿勢推定を実行（MediaPipe Pose）</li>
          <li>Step 2: Space キーで接地をマーク（各セグメント4ステップ推奨）</li>
          <li>Step 3: 解析実行ボタンをクリック</li>
          <li>←/→: フレーム移動</li>
          <li>スライダー: 任意のフレームへジャンプ</li>
        </ul>
      </div>
    </div>
  );
};
