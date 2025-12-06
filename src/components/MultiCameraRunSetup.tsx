import React, { useState, useCallback } from 'react';
import { Upload, Video, CheckCircle, AlertCircle, Settings, Play } from 'lucide-react';
import { Run, RunSegment } from '../types/multiCamera';
import { v4 as uuidv4 } from 'uuid';

interface MultiCameraRunSetupProps {
  athleteId?: string;
  onStartAnalysis: (run: Run, segments: RunSegment[], videoFiles: { [key: string]: File }) => void;
  onCancel: () => void;
  // 既存の解析関数を受け取る
  processSegmentVideo?: (video: File, segment: RunSegment) => Promise<string>; // sessionIdを返す
}

export const MultiCameraRunSetup: React.FC<MultiCameraRunSetupProps> = ({
  athleteId,
  onStartAnalysis,
  onCancel,
  processSegmentVideo
}) => {
  const [currentStep, setCurrentStep] = useState<'config' | 'upload' | 'calibrate'>('config');
  const [runConfig, setRunConfig] = useState<Run | null>(null);
  const [segments, setSegments] = useState<RunSegment[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<{ [key: string]: File }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const distanceOptions = [20, 30, 40, 60, 80, 100];
  const segmentLength = 10; // 固定

  const handleConfigSubmit = (totalDistance: number, label: string) => {
    const numSegments = totalDistance / segmentLength;
    const newRun: Run = {
      id: uuidv4(),
      label: label || `${totalDistance}m Run ${new Date().toLocaleDateString()}`,
      totalDistanceM: totalDistance,
      segmentLengthM: segmentLength,
      createdAt: new Date(),
      athleteId,
      status: 'setup'
    };

    const newSegments: RunSegment[] = [];
    for (let i = 0; i < numSegments; i++) {
      newSegments.push({
        id: uuidv4(),
        runId: newRun.id,
        segmentIndex: i,
        startDistanceM: i * segmentLength,
        endDistanceM: (i + 1) * segmentLength,
        status: 'pending'
      });
    }

    setRunConfig(newRun);
    setSegments(newSegments);
    setCurrentStep('upload');
  };

  const handleVideoSelect = (segmentId: string, file: File) => {
    setSelectedVideos(prev => ({ ...prev, [segmentId]: file }));
    setSegments(prev => prev.map(seg => 
      seg.id === segmentId ? { ...seg, status: 'uploaded' as const, videoUrl: URL.createObjectURL(file) } : seg
    ));
  };

  const handleStartAnalysis = async () => {
    if (!runConfig || segments.some(seg => seg.status !== 'uploaded' && seg.status !== 'completed')) {
      alert('すべてのセグメントに動画をアップロードしてください');
      return;
    }

    // 既存の解析処理を呼び出す
    if (processSegmentVideo) {
      for (const segment of segments) {
        const video = selectedVideos[segment.id];
        if (video) {
          try {
            const sessionId = await processSegmentVideo(video, segment);
            segment.sessionId = sessionId;
            segment.status = 'completed';
          } catch (error) {
            console.error(`セグメント${segment.segmentIndex}の処理エラー:`, error);
            segment.status = 'error';
          }
        }
      }
    }

    onStartAnalysis(runConfig, segments, selectedVideos);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        {/* ステップインジケーター */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${currentStep === 'config' ? 'text-blue-600' : 'text-gray-400'}`}>
              <Settings className="w-5 h-5 mr-2" />
              <span className="font-medium">1. ラン設定</span>
            </div>
            <div className={`flex items-center ${currentStep === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
              <Upload className="w-5 h-5 mr-2" />
              <span className="font-medium">2. 動画アップロード</span>
            </div>
            <div className={`flex items-center ${currentStep === 'calibrate' ? 'text-blue-600' : 'text-gray-400'}`}>
              <Video className="w-5 h-5 mr-2" />
              <span className="font-medium">3. キャリブレーション</span>
            </div>
          </div>
        </div>

        {/* Step 1: ラン設定 */}
        {currentStep === 'config' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">マルチカメララン設定</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  総距離を選択
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {distanceOptions.map(distance => (
                    <button
                      key={distance}
                      onClick={() => {
                        const label = prompt('ランのラベルを入力してください（オプション）');
                        handleConfigSubmit(distance, label || '');
                      }}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                    >
                      <div className="text-2xl font-bold">{distance}m</div>
                      <div className="text-sm text-gray-500">
                        {distance / segmentLength}セグメント
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  各セグメントは{segmentLength}m単位で撮影されます。
                  カメラは各セグメントを固定位置から撮影してください。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 動画アップロード */}
        {currentStep === 'upload' && runConfig && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">
              {runConfig.label} - セグメント動画アップロード
            </h2>
            <div className="space-y-4">
              {segments.map((segment, index) => (
                <div key={segment.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">
                        セグメント {index + 1} ({segment.startDistanceM}〜{segment.endDistanceM}m)
                      </h3>
                      <div className="mt-2">
                        {segment.status === 'pending' ? (
                          <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                            <Upload className="w-4 h-4 mr-2" />
                            動画を選択
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleVideoSelect(segment.id, file);
                              }}
                            />
                          </label>
                        ) : (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="w-5 h-5 mr-2" />
                            {selectedVideos[segment.id]?.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      {segment.status === 'uploaded' && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                          アップロード済み
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button
                onClick={onCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleStartAnalysis}
                disabled={segments.some(seg => seg.status === 'pending')}
                className={`px-6 py-2 rounded-lg flex items-center ${
                  segments.every(seg => seg.status !== 'pending')
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

export default MultiCameraRunSetup;