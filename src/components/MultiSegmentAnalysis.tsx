/**
 * Multi-Segment Analysis
 * 
 * シングルカメラモードを3回実行して結果を統合
 */

import { useState } from 'react';
import { Upload, Play, Check, X, ArrowLeft } from 'lucide-react';
import { mergeSegmentResults, type SingleCameraResult, type MergedSegmentResult } from '../utils/multiSegmentMerger';

interface SegmentConfig {
  id: string;
  label: string;
  startDistanceM: number;
  endDistanceM: number;
  videoFile: File | null;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  result: SingleCameraResult | null;
}

interface Props {
  onBack: () => void;
}

export default function MultiSegmentAnalysis({ onBack }: Props) {
  const [segments, setSegments] = useState<SegmentConfig[]>([
    { id: 'seg1', label: 'セグメント1', startDistanceM: 0, endDistanceM: 5, videoFile: null, status: 'pending', result: null },
    { id: 'seg2', label: 'セグメント2', startDistanceM: 5, endDistanceM: 10, videoFile: null, status: 'pending', result: null },
    { id: 'seg3', label: 'セグメント3', startDistanceM: 10, endDistanceM: 15, videoFile: null, status: 'pending', result: null },
  ]);

  const [mergedResult, setMergedResult] = useState<MergedSegmentResult | null>(null);
  const [currentStep, setCurrentStep] = useState<'upload' | 'analyze' | 'results'>('upload');

  const handleVideoUpload = (segmentId: string, file: File) => {
    setSegments(prev => prev.map(seg => 
      seg.id === segmentId ? { ...seg, videoFile: file } : seg
    ));
  };

  const handleRemoveVideo = (segmentId: string) => {
    setSegments(prev => prev.map(seg => 
      seg.id === segmentId ? { ...seg, videoFile: null, status: 'pending', result: null } : seg
    ));
  };

  const allVideosUploaded = segments.every(seg => seg.videoFile !== null);

  const handleStartAnalysis = () => {
    setCurrentStep('analyze');
    alert('各セグメントをシングルカメラモードで個別に解析してください。\n\n手順:\n1. 「戻る」ボタンでホームに戻る\n2. 各動画をシングルカメラモードで解析\n3. 解析結果をメモ（距離・ストライド等）\n4. 再度「複数セグメント解析」を開く\n5. 結果を手動入力（今後自動化予定）');
  };

  const handleMerge = () => {
    // デモ用のダミーデータ
    const demoResults: SingleCameraResult[] = segments.map((seg, idx) => ({
      segmentId: seg.id,
      segmentIndex: idx,
      startDistanceM: seg.startDistanceM,
      endDistanceM: seg.endDistanceM,
      steps: [
        {
          index: 0,
          contactFrame: 10,
          toeOffFrame: 15,
          contactTime: 0.1,
          flightTime: 0.15,
          stride: 1.5,
          fullStride: 1.5,
          distanceAtContact: 0.5,
          speedMps: 6.0,
          cadence: 180,
          quality: 'good',
          isInterpolated: false,
        },
        {
          index: 1,
          contactFrame: 30,
          toeOffFrame: 35,
          contactTime: 0.1,
          flightTime: 0.15,
          stride: 1.6,
          fullStride: 1.6,
          distanceAtContact: 2.0,
          speedMps: 6.4,
          cadence: 180,
          quality: 'good',
          isInterpolated: false,
        },
        {
          index: 2,
          contactFrame: 50,
          toeOffFrame: 55,
          contactTime: 0.1,
          flightTime: 0.15,
          stride: 1.5,
          fullStride: 1.5,
          distanceAtContact: 3.5,
          speedMps: 6.0,
          cadence: 180,
          quality: 'good',
          isInterpolated: false,
        },
        {
          index: 3,
          contactFrame: 70,
          toeOffFrame: 75,
          contactTime: 0.1,
          flightTime: 0.15,
          stride: null,
          fullStride: null,
          distanceAtContact: 4.8,
          speedMps: null,
          cadence: null,
          quality: 'good',
          isInterpolated: false,
        },
      ],
    }));

    const merged = mergeSegmentResults(demoResults);
    setMergedResult(merged);
    setCurrentStep('results');
  };

  if (currentStep === 'results' && mergedResult) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => {
              setCurrentStep('upload');
              setMergedResult(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            <ArrowLeft className="w-4 h-4" />
            戻る
          </button>
          <h1 className="text-3xl font-bold">統合結果</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">総距離</div>
            <div className="text-2xl font-bold">{mergedResult.totalDistanceM}m</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">総ステップ数</div>
            <div className="text-2xl font-bold">{mergedResult.totalSteps}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">平均ストライド</div>
            <div className="text-2xl font-bold">{mergedResult.avgStrideM.toFixed(2)}m</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">平均速度</div>
            <div className="text-2xl font-bold">{mergedResult.avgSpeedMps.toFixed(2)}m/s</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">ステップ詳細</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">セグメント</th>
                  <th className="text-right p-2">距離 (m)</th>
                  <th className="text-right p-2">ストライド (m)</th>
                  <th className="text-right p-2">速度 (m/s)</th>
                </tr>
              </thead>
              <tbody>
                {mergedResult.allSteps.map((step, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-2">{step.globalIndex + 1}</td>
                    <td className="p-2">{step.segmentId}</td>
                    <td className="p-2 text-right">{step.distanceAtContact.toFixed(2)}</td>
                    <td className="p-2 text-right">
                      {step.stride !== null ? step.stride.toFixed(3) : '-'}
                    </td>
                    <td className="p-2 text-right">
                      {step.speedMps !== null ? step.speedMps.toFixed(2) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
          戻る
        </button>
        <h1 className="text-3xl font-bold">複数セグメント解析</h1>
      </div>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <h2 className="font-bold text-blue-900 mb-2">📘 使い方</h2>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>3本の動画をアップロード（各セグメント5m）</li>
          <li>各セグメントをシングルカメラモードで個別に解析</li>
          <li>結果を統合して15m全体のデータを生成</li>
        </ol>
      </div>

      <div className="space-y-4 mb-6">
        {segments.map(segment => (
          <div key={segment.id} className="border rounded-lg p-4 bg-white shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{segment.label}</h3>
                <p className="text-sm text-gray-600">
                  範囲: {segment.startDistanceM}m - {segment.endDistanceM}m
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                {segment.videoFile ? (
                  <>
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="w-5 h-5" />
                      <span className="text-sm">{segment.videoFile.name}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveVideo(segment.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                      title="削除"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600">
                    <Upload className="w-4 h-4" />
                    <span>動画を選択</span>
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
                
                {segment.status === 'completed' && (
                  <div className="text-green-600 font-bold">✓ 完了</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {allVideosUploaded && (
        <>
          <button
            className="w-full bg-green-500 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-600 mb-4"
            onClick={handleStartAnalysis}
          >
            <Play className="w-5 h-5" />
            解析を開始
          </button>
          
          <button
            className="w-full bg-purple-500 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-purple-600"
            onClick={handleMerge}
          >
            デモ: 統合結果を表示
          </button>
        </>
      )}
    </div>
  );
}
