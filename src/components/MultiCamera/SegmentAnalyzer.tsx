/**
 * SegmentAnalyzer Component
 * Handles individual segment video analysis with frame extraction and pose estimation
 */

import React, { useState, useRef, useEffect } from 'react';
import { SegmentRawData, CalibrationData, FramePoseData } from './types';
import { analyzeSegment } from '../../utils/multiCamera/multiCameraCore';
import { extractFramesFromVideo } from '../../utils/videoProcessing';

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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [framesExtracted, totalFrames]);
  
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
          disabled={contactMarks.length < 3 || !segment.calibration}
          style={{
            marginRight: '10px',
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: contactMarks.length >= 3 && segment.calibration ? '#4CAF50' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: contactMarks.length >= 3 && segment.calibration ? 'pointer' : 'not-allowed',
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
          <li>Space: 現在のフレームで接地をマーク</li>
          <li>←/→: フレーム移動</li>
          <li>スライダー: 任意のフレームへジャンプ</li>
          <li>各セグメントで4ステップをマークしてください</li>
        </ul>
      </div>
    </div>
  );
};
