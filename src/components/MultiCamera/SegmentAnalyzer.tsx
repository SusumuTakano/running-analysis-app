/**
 * SegmentAnalyzer Component
 * Handles individual segment video analysis
 */

import React, { useState, useRef, useEffect } from 'react';
import { SegmentRawData, CalibrationData, FramePoseData } from './types';
import { analyzeSegment } from '../../utils/multiCamera/multiCameraCore';

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
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [contactMarks, setContactMarks] = useState<number[]>([]);
  const [showCalibration, setShowCalibration] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Video loading
  useEffect(() => {
    if (videoRef.current && segment.videoObjectURL) {
      videoRef.current.src = segment.videoObjectURL;
      videoRef.current.onloadedmetadata = () => {
        const fps = 120; // Assume 120 fps
        const duration = videoRef.current!.duration;
        setTotalFrames(Math.floor(duration * fps));
        setStatus('ビデオ読み込み完了');
      };
    }
  }, [segment.videoObjectURL]);
  
  // Keyboard controls
  useEffect(() => {
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
  }, [totalFrames]);
  
  const handleMarkContact = () => {
    setContactMarks(prev => [...prev, currentFrame]);
    setStatus(`接地マーク: ${contactMarks.length + 1}回`);
  };
  
  const handleAnalyze = () => {
    // Update segment with marked contacts
    const updatedSegment: SegmentRawData = {
      ...segment,
      contactFrames: contactMarks,
    };
    
    // Run analysis
    const result = analyzeSegment(updatedSegment);
    onAnalysisComplete(result);
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>セグメント {segment.segmentIndex + 1} 解析</h2>
      <p>範囲: {segment.startDistanceM}m - {segment.endDistanceM}m</p>
      
      <div style={{ marginBottom: '20px' }}>
        <video
          ref={videoRef}
          width={960}
          height={540}
          controls
          style={{ border: '1px solid #ccc' }}
        />
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <p>ステータス: {status}</p>
        <p>現在のフレーム: {currentFrame} / {totalFrames}</p>
        <p>接地マーク: {contactMarks.length}回</p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleMarkContact} style={{ marginRight: '10px' }}>
          接地をマーク (Space)
        </button>
        <button onClick={() => setShowCalibration(!showCalibration)} style={{ marginRight: '10px' }}>
          {showCalibration ? 'キャリブレーション非表示' : 'キャリブレーション表示'}
        </button>
      </div>
      
      {showCalibration && (
        <div style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '20px' }}>
          <h3>キャリブレーション</h3>
          <p>4つのコーンをクリックしてください（左近→左遠→右近→右遠）</p>
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            style={{ border: '1px solid #999', cursor: 'crosshair' }}
          />
        </div>
      )}
      
      <div>
        <button
          onClick={handleAnalyze}
          disabled={contactMarks.length < 3 || !segment.calibration}
          style={{
            marginRight: '10px',
            padding: '10px 20px',
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
            padding: '10px 20px',
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
          <li>各セグメントで4ステップをマークしてください</li>
        </ul>
      </div>
    </div>
  );
};
