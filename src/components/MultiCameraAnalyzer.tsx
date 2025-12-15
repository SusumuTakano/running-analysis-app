import React, { useEffect, useMemo, useState } from "react";
import { analyzeSegment, mergeSegments } from "../utils/multiCameraAnalysis";
import {
  Run,
  RunSegment,
  SegmentAnalysisResult,
  RunAnalysisResult,
} from "../types/multiCameraTypes";

type Props = {
  run: Run;
  segments: RunSegment[];
  // 既存の「単体（シングルカメラ）解析」を渡す。戻り値は rawResults（stepMetrics等を含む）想定。
  analyzeSingle: (file: File) => Promise<any>;
  onBackToSetup: () => void;
};

export const MultiCameraAnalyzer: React.FC<Props> = ({
  run,
  segments,
  analyzeSingle,
  onBackToSetup,
}) => {
  const sortedSegments = useMemo(() => {
    return [...segments].sort((a, b) => {
      const ai = typeof a.segmentIndex === "number" ? a.segmentIndex : null;
      const bi = typeof b.segmentIndex === "number" ? b.segmentIndex : null;
      if (ai !== null && bi !== null) return ai - bi;
      if (ai !== null && bi === null) return -1;
      if (ai === null && bi !== null) return 1;
      return a.startDistanceM - b.startDistanceM;
    });
  }, [segments]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<SegmentAnalysisResult[]>([]);
  const [merged, setMerged] = useState<RunAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const runAll = async () => {
      setIsRunning(true);
      setError(null);
      setMerged(null);
      setResults([]);
      setCurrentIdx(0);

      try {
        for (let i = 0; i < sortedSegments.length; i++) {
          if (cancelled) return;
          setCurrentIdx(i);

          const seg = sortedSegments[i];
          const file = seg.videoFile;

          if (!file) {
            throw new Error(
              `セグメント ${seg.startDistanceM}-${seg.endDistanceM}m の動画ファイルが見つかりません`
            );
          }
          if (!seg.calibration) {
            throw new Error(
              `セグメント ${seg.startDistanceM}-${seg.endDistanceM}m のキャリブレーションが未設定です`
            );
          }

          const r = await analyzeSegment(file, seg, analyzeSingle);
          if (cancelled) return;

          setResults((prev) => [...prev, r]);
        }

        if (cancelled) return;

        const mergedResult = mergeSegments(run, sortedSegments, results.length ? results : []);
        // ↑ results は state 更新が非同期なので、直前の配列を使うために下で再生成します
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setIsRunning(false);
      }
    };

    runAll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id]); // runが変わったら再実行

  // results の state は非同期なので、別effectで merged を確定させる
  useEffect(() => {
    if (results.length !== sortedSegments.length) return;
    try {
      const mergedResult = mergeSegments(run, sortedSegments, results);
      setMerged(mergedResult);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [results, sortedSegments, run]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">マルチカメラ解析中</h2>
          <button
            onClick={onBackToSetup}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            セットアップに戻る
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          進捗: {Math.min(currentIdx + (isRunning ? 1 : 0), sortedSegments.length)}/
          {sortedSegments.length}
        </div>

        <div className="mt-4 space-y-2">
          {sortedSegments.map((s, i) => {
            const done = results.find((r) => r.segmentId === s.id);
            const active = i === currentIdx && isRunning;
            return (
              <div key={s.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {s.startDistanceM}〜{s.endDistanceM}m
                  </div>
                  <div className="text-sm">
                    {done ? (
                      <span className="text-green-600">完了</span>
                    ) : active ? (
                      <span className="text-blue-600">解析中…</span>
                    ) : (
                      <span className="text-gray-500">待機</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-6 p-4 rounded-lg bg-red-50 text-red-700">
            エラー: {error}
          </div>
        )}

        {merged && (
          <div className="mt-6 p-4 rounded-lg bg-blue-50">
            <div className="font-medium mb-2">統合結果（暫定）</div>
            <div className="text-sm space-y-1">
              <div>総距離: {merged.summary.totalDistance} m</div>
              <div>総ステップ数: {merged.summary.totalSteps}</div>
              <div>平均速度: {merged.summary.avgSpeed.toFixed(2)} m/s</div>
              <div>最大速度: {merged.summary.maxSpeed.toFixed(2)} m/s</div>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              ※ ここではまず「3本解析→統合」が通ることを確認します。連続速度の“滑らか化（リンクa,b・v(x)）”は次段階で入れます。
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiCameraAnalyzer;
