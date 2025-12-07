/**
 * Multi-Camera Setup Component
 * Clean UI flow for multi-segment video upload and analysis
 */

import React, { useState, useCallback } from 'react';
import { Upload, Play, CheckCircle, AlertCircle, ChevronRight, Settings } from 'lucide-react';
import { 
  Run, 
  RunSegment, 
  MultiCameraConfig 
} from '../types/multiCameraTypes';
import { generateSegments } from '../utils/multiCameraAnalysis';
import { v4 as uuidv4 } from 'uuid';

interface MultiCameraSetupProps {
  athleteId?: string;
  athleteName?: string;
  onStartAnalysis: (run: Run, segments: RunSegment[]) => void;
  onCancel: () => void;
}

export const MultiCameraSetup: React.FC<MultiCameraSetupProps> = ({
  athleteId,
  athleteName,
  onStartAnalysis,
  onCancel
}) => {
  const [step, setStep] = useState<'config' | 'upload' | 'ready'>('config');
  const [config, setConfig] = useState<MultiCameraConfig>({
    segmentLengthM: 10,
    totalDistanceM: 30,
    fps: 60
  });
  const [run, setRun] = useState<Run | null>(null);
  const [segments, setSegments] = useState<RunSegment[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, File>>(new Map());

  // Step 1: Configure run parameters
  const handleConfigSubmit = useCallback(() => {
    const newRun: Run = {
      id: uuidv4(),
      athleteId,
      athleteName,
      totalDistanceM: config.totalDistanceM,
      date: new Date(),
      status: 'setup',
      createdAt: new Date()
    };
    
    const newSegments = generateSegments(
      newRun.id,
      config.totalDistanceM,
      config.segmentLengthM
    );
    
    // Set FPS for all segments
    newSegments.forEach(seg => seg.fps = config.fps);
    
    setRun(newRun);
    setSegments(newSegments);
    setStep('upload');
  }, [config, athleteId, athleteName]);

  // Step 2: Handle video uploads
  const handleVideoUpload = useCallback((segmentId: string, file: File) => {
    setUploadedFiles(prev => new Map(prev).set(segmentId, file));
    
    setSegments(prev => prev.map(seg => 
      seg.id === segmentId 
        ? { ...seg, videoFile: file, status: 'completed' as const }
        : seg
    ));
  }, []);

  // Step 3: Start analysis
  const handleStartAnalysis = useCallback(() => {
    if (!run) return;
    
    // Update segments with uploaded files
    const finalSegments = segments.map(seg => ({
      ...seg,
      videoFile: uploadedFiles.get(seg.id)
    }));
    
    // Check if all segments have videos
    const missingVideos = finalSegments.filter(s => !s.videoFile);
    if (missingVideos.length > 0) {
      alert(`動画がアップロードされていないセグメントがあります: ${missingVideos.map(s => `${s.startDistanceM}-${s.endDistanceM}m`).join(', ')}`);
      return;
    }
    
    onStartAnalysis(run, finalSegments);
  }, [run, segments, uploadedFiles, onStartAnalysis]);

  // Check if all videos are uploaded
  const allVideosUploaded = segments.every(seg => uploadedFiles.has(seg.id));

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Progress indicator */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${step === 'config' ? 'text-blue-600' : 'text-gray-400'}`}>
              <Settings className="w-5 h-5 mr-2" />
              <span className="font-medium">1. 設定</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
            <div className={`flex items-center ${step === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
              <Upload className="w-5 h-5 mr-2" />
              <span className="font-medium">2. 動画アップロード</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
            <div className={`flex items-center ${step === 'ready' ? 'text-blue-600' : 'text-gray-400'}`}>
              <Play className="w-5 h-5 mr-2" />
              <span className="font-medium">3. 解析開始</span>
            </div>
          </div>
        </div>

        {/* Step 1: Configuration */}
        {step === 'config' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-6">マルチカメラ解析設定</h2>
            
            <div className="space-y-6">
              {/* Segment length selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  セグメント長
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[5, 10].map(length => (
                    <button
                      key={length}
                      onClick={() => setConfig(prev => ({ ...prev, segmentLengthM: length }))}
                      className={`p-4 border-2 rounded-lg transition ${
                        config.segmentLengthM === length
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xl font-bold">{length}m</div>
                      <div className="text-sm text-gray-500">
                        {length === 5 ? '詳細解析向け' : '標準・推奨'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Total distance selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  総走行距離
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(config.segmentLengthM === 10 
                    ? [20, 30, 40, 60, 80, 100]
                    : [10, 15, 20, 30, 40, 50]
                  ).map(distance => (
                    <button
                      key={distance}
                      onClick={() => setConfig(prev => ({ ...prev, totalDistanceM: distance }))}
                      className={`p-4 border-2 rounded-lg transition ${
                        config.totalDistanceM === distance
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xl font-bold">{distance}m</div>
                      <div className="text-sm text-gray-500">
                        {Math.ceil(distance / config.segmentLengthM)}カメラ
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* FPS selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  フレームレート
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[60, 120, 240].map(fps => (
                    <button
                      key={fps}
                      onClick={() => setConfig(prev => ({ ...prev, fps }))}
                      className={`p-3 border-2 rounded-lg transition ${
                        config.fps === fps
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold">{fps}fps</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">設定内容</h3>
                <ul className="text-sm space-y-1">
                  <li>• 総距離: {config.totalDistanceM}m</li>
                  <li>• セグメント: {config.segmentLengthM}m × {Math.ceil(config.totalDistanceM / config.segmentLengthM)}区間</li>
                  <li>• フレームレート: {config.fps}fps</li>
                </ul>
              </div>

              <button
                onClick={handleConfigSubmit}
                className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                次へ: 動画アップロード
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Video Upload */}
        {step === 'upload' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-6">
              セグメント動画のアップロード
            </h2>
            
            <div className="space-y-4">
              {segments.map((segment, idx) => (
                <div key={segment.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">
                        カメラ {idx + 1}: {segment.startDistanceM}〜{segment.endDistanceM}m
                      </h3>
                      {uploadedFiles.has(segment.id) ? (
                        <div className="flex items-center text-green-600 mt-2">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {uploadedFiles.get(segment.id)?.name}
                        </div>
                      ) : (
                        <label className="inline-flex items-center mt-2 px-4 py-2 bg-gray-100 rounded cursor-pointer hover:bg-gray-200">
                          <Upload className="w-4 h-4 mr-2" />
                          動画を選択
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoUpload(segment.id, file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                    {uploadedFiles.has(segment.id) && (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep('config')}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                戻る
              </button>
              <button
                onClick={handleStartAnalysis}
                disabled={!allVideosUploaded}
                className={`flex-1 px-6 py-3 rounded-lg flex items-center justify-center ${
                  allVideosUploaded
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 mr-2" />
                解析開始
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiCameraSetup;