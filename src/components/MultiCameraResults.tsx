/**
 * Multi-Camera Results Component
 * Displays merged analysis results with charts and tables
 */

import React, { useMemo } from 'react';
// Chart library will be added later
// For now, we'll show data in table format only
import { Download, TrendingUp, Clock, Activity } from 'lucide-react';
import { RunAnalysisResult } from '../types/multiCameraTypes';

interface MultiCameraResultsProps {
  result: RunAnalysisResult;
  onExport?: () => void;
  onReset?: () => void;
}

export const MultiCameraResults: React.FC<MultiCameraResultsProps> = ({
  result,
  onExport,
  onReset
}) => {
  // Prepare chart data
  const chartData = useMemo(() => {
    return result.allSteps.map(step => ({
      stepNumber: step.globalStepIndex || 0,
      distance: step.distanceFromRunStartM?.toFixed(1) || '0',
      speed: step.speedMps?.toFixed(2) || 0,
      contactTime: (step.contactTimeSec * 1000).toFixed(0), // Convert to ms
      flightTime: (step.flightTimeSec * 1000).toFixed(0), // Convert to ms
      stepLength: step.stepLengthM.toFixed(2),
      cadence: step.cadence?.toFixed(1) || 0
    }));
  }, [result]);

  // Format time in seconds
  const formatTime = (seconds: number) => {
    return `${seconds.toFixed(2)}秒`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">マルチカメラ解析結果</h1>
              <p className="text-gray-600 mt-1">
                {result.run.athleteName || '選手'} - {result.run.totalDistanceM}m走
              </p>
            </div>
            <div className="flex gap-3">
              {onExport && (
                <button
                  onClick={onExport}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  エクスポート
                </button>
              )}
              {onReset && (
                <button
                  onClick={onReset}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  新規解析
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center text-gray-600 mb-2">
              <TrendingUp className="w-5 h-5 mr-2" />
              <span className="text-sm">平均速度</span>
            </div>
            <div className="text-2xl font-bold">{result.summary.avgSpeed.toFixed(2)} m/s</div>
            <div className="text-sm text-gray-500 mt-1">
              最高: {result.summary.maxSpeed.toFixed(2)} m/s
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center text-gray-600 mb-2">
              <Activity className="w-5 h-5 mr-2" />
              <span className="text-sm">総ステップ数</span>
            </div>
            <div className="text-2xl font-bold">{result.summary.totalSteps} 歩</div>
            <div className="text-sm text-gray-500 mt-1">
              平均ストライド: {result.summary.avgStepLength.toFixed(2)}m
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center text-gray-600 mb-2">
              <Clock className="w-5 h-5 mr-2" />
              <span className="text-sm">タイム</span>
            </div>
            <div className="text-2xl font-bold">{formatTime(result.summary.totalTime)}</div>
            <div className="text-sm text-gray-500 mt-1">
              ケイデンス: {result.summary.avgCadence.toFixed(1)} 歩/分
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center text-gray-600 mb-2">
              <span className="text-sm">接地/滞空時間</span>
            </div>
            <div className="text-2xl font-bold">
              {(result.summary.avgContactTime * 1000).toFixed(0)}ms
            </div>
            <div className="text-sm text-gray-500 mt-1">
              滞空: {(result.summary.avgFlightTime * 1000).toFixed(0)}ms
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="p-6 space-y-6">
          {/* Charts will be added when recharts is installed */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">詳細データ</h3>
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">歩数</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">距離(m)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">速度(m/s)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ストライド(m)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">接地時間(ms)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">滞空時間(ms)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {chartData.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-sm">{row.stepNumber}</td>
                      <td className="px-3 py-2 text-sm">{row.distance}</td>
                      <td className="px-3 py-2 text-sm">{row.speed}</td>
                      <td className="px-3 py-2 text-sm">{row.stepLength}</td>
                      <td className="px-3 py-2 text-sm">{row.contactTime}</td>
                      <td className="px-3 py-2 text-sm">{row.flightTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Segment Details Table */}
        <div className="p-6">
          <h3 className="text-lg font-medium mb-4">セグメント別詳細</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    区間
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ステップ数
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    平均速度
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    平均ストライド
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    平均接地時間
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    平均滞空時間
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {result.segments.map((segment, idx) => {
                  const segmentSteps = result.allSteps.filter(s => 
                    s.distanceFromRunStartM! >= segment.startDistanceM &&
                    s.distanceFromRunStartM! < segment.endDistanceM
                  );
                  
                  if (segmentSteps.length === 0) return null;
                  
                  const avgSpeed = segmentSteps.reduce((sum, s) => sum + (s.speedMps || 0), 0) / segmentSteps.length;
                  const avgStride = segmentSteps.reduce((sum, s) => sum + s.stepLengthM, 0) / segmentSteps.length;
                  const avgContact = segmentSteps.reduce((sum, s) => sum + s.contactTimeSec, 0) / segmentSteps.length;
                  const avgFlight = segmentSteps.reduce((sum, s) => sum + s.flightTimeSec, 0) / segmentSteps.length;
                  
                  return (
                    <tr key={segment.id}>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {segment.startDistanceM}〜{segment.endDistanceM}m
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {segmentSteps.length}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {avgSpeed.toFixed(2)} m/s
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {avgStride.toFixed(2)} m
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {(avgContact * 1000).toFixed(0)} ms
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {(avgFlight * 1000).toFixed(0)} ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiCameraResults;