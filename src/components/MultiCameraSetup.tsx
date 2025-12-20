/**
 * Multi-Camera Setup Component
 * Clean UI flow for multi-segment video upload and analysis
 *
 * Updated:
 * - Support marker-based calibration (cones at x0/x1, near/far)
 * - Support capture range margins (e.g., -1〜6m) while analysis segment remains 0〜5m, 5〜10m...
 * - Add calibration step (click 4 cones in order)
 *
 * Fixes:
 * - Keep blob video URLs in parent (MultiCameraSetup) so they are not revoked when leaving calibration UI
 * - Fix Homography type mismatch by NOT forcing number[] types
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Upload, Play, CheckCircle, ChevronRight, Settings, Crosshair, Undo2, Trash2 } from 'lucide-react';
import {
  Run,
  RunSegment,
  MultiCameraConfig,
  SegmentCalibration,
  ImgPoint
} from '../types/multiCameraTypes';
import { generateSegments, computeHomographyImgToWorld } from '../utils/multiCameraAnalysis';
import { v4 as uuidv4 } from 'uuid';

interface MultiCameraSetupProps {
  athleteId?: string;
  athleteName?: string;
  onStartAnalysis: (run: Run, segments: RunSegment[]) => void;
  onCancel: () => void;
}

type Step = 'config' | 'upload' | 'calibrate';

const CLICK_LABELS = ['x0 手前(カメラ側)', 'x0 奥(反対側)', 'x1 手前(カメラ側)', 'x1 奥(反対側)'] as const;

function formatRange(a?: number, b?: number) {
  if (typeof a !== 'number' || typeof b !== 'number') return '';
  const ra = Number.isInteger(a) ? a.toString() : a.toFixed(1);
  const rb = Number.isInteger(b) ? b.toString() : b.toFixed(1);
  return `${ra}〜${rb}m`;
}

function intersectRange(aStart?: number, aEnd?: number, bStart?: number, bEnd?: number) {
  if ([aStart, aEnd, bStart, bEnd].some(v => typeof v !== 'number')) return null;
  const s = Math.max(aStart!, bStart!);
  const e = Math.min(aEnd!, bEnd!);
  if (e <= s) return null;
  return { start: s, end: e };
}

// H が 3x3 でも flat(9) でも許容して「数値が入っているか」だけチェック
function isValidHomography(h: unknown): boolean {
  if (!h) return false;

  // 3x3 matrix
  if (
    Array.isArray(h) &&
    h.length === 3 &&
    (h as unknown[]).every((r: unknown) => Array.isArray(r) && (r as unknown[]).length === 3)
  ) {
    return (h as unknown[][]).every((r: unknown[]) =>
      r.every((v: unknown) => typeof v === 'number' && Number.isFinite(v))
    );
  }

  // flat 9
  if (Array.isArray(h) && h.length === 9) {
    return (h as unknown[]).every((v: unknown) => typeof v === 'number' && Number.isFinite(v));
  }

  return false;
}


const CalibrationPanel: React.FC<{
  segment: RunSegment;
  videoUrl: string;              // ✅ Fileではなく URL を受け取る（blob を親で管理）
  laneWidthM: number;
  onSave: (segmentId: string, calibration: SegmentCalibration) => void;
}> = ({ segment, videoUrl, laneWidthM, onSave }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [points, setPoints] = useState<Array<{ px: ImgPoint; norm: ImgPoint }>>([]);

  const nextLabel = CLICK_LABELS[Math.min(points.length, 3)];

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (!videoRef.current || !overlayRef.current) return;
    if (points.length >= 4) return;

    const v = videoRef.current;
    const rect = overlayRef.current.getBoundingClientRect();

    const xRel = e.clientX - rect.left;
    const yRel = e.clientY - rect.top;

    const xNorm = xRel / rect.width;
    const yNorm = yRel / rect.height;

    // Convert to intrinsic video pixels (important for later homography)
    const vw = v.videoWidth || rect.width;
    const vh = v.videoHeight || rect.height;
    const xPx = xNorm * vw;
    const yPx = yNorm * vh;

    setPoints(prev => [...prev, { px: [xPx, yPx], norm: [xNorm, yNorm] }]);
  }, [points.length]);

  const undo = useCallback(() => {
    setPoints(prev => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setPoints([]);
  }, []);

  const save = useCallback(() => {
    if (points.length !== 4) return;

    const x0 = segment.startDistanceM;
    const x1 = segment.endDistanceM;

    const imgPoints = {
      x0_near: points[0].px,
      x0_far: points[1].px,
      x1_near: points[2].px,
      x1_far: points[3].px
    };

    // World points: x-axis = lane width (0~1.22m), y-axis = running direction (0~15m)
    // near = camera-side (x=0), far = opposite-side (x=laneWidthM)
    const worldPoints = {
      x0_near: [0, x0] as [number, number],          // (0, startDistanceM)
      x0_far: [laneWidthM, x0] as [number, number],  // (1.22, startDistanceM)
      x1_near: [0, x1] as [number, number],          // (0, endDistanceM)
      x1_far: [laneWidthM, x1] as [number, number]   // (1.22, endDistanceM)
    };

    let H: SegmentCalibration['H_img_to_world'] | null = null;

    try {
      // ✅ ここで型を決め打ちしない（compute の戻り型に合わせる）
      H = computeHomographyImgToWorld(imgPoints, worldPoints) as SegmentCalibration['H_img_to_world'];
    } catch (err) {
      console.error('Homography compute failed:', err);
      alert('キャリブレーション計算に失敗しました。別フレームで4点を取り直してください。');
      return;
    }

    if (!isValidHomography(H)) {
      console.error('Invalid homography:', H);
      alert('キャリブレーション計算に失敗しました（Hが不正）。4点を取り直してください。');
      return;
    }

    const calibration: SegmentCalibration = {
      laneWidthM,
      x0_m: x0,
      x1_m: x1,
      imgPoints,
      H_img_to_world: H
    };

    onSave(segment.id, calibration);
  }, [points, segment, laneWidthM, onSave]);

  // Marker dots for UI (normalized)
  const dots = points.map((p, idx) => (
    <div
      key={idx}
      className="absolute w-4 h-4 rounded-full border-2 border-white shadow"
      style={{
        left: `${p.norm[0] * 100}%`,
        top: `${p.norm[1] * 100}%`,
        transform: 'translate(-50%, -50%)'
      }}
      title={CLICK_LABELS[idx] ?? ''}
    />
  ));

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium">
            キャリブレーション: {segment.startDistanceM}m と {segment.endDistanceM}m（手前/奥）
          </div>
          <div className="text-sm text-gray-600 mt-1">
            クリック順: <span className="font-medium">{nextLabel}</span>
            {points.length < 4 && <span> をクリックしてください（{points.length}/4）</span>}
            {points.length === 4 && <span>（4点揃いました。保存できます）</span>}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ※ 必ず「コーンの中心」をクリック。4点すべて同じフレームで実施してください。
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={points.length === 0}
            className="px-3 py-2 rounded bg-white border hover:bg-gray-100 disabled:opacity-50"
            title="ひとつ戻す"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={clear}
            disabled={points.length === 0}
            className="px-3 py-2 rounded bg-white border hover:bg-gray-100 disabled:opacity-50"
            title="クリア"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={save}
            disabled={points.length !== 4}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-600"
          >
            保存
          </button>
        </div>
      </div>

      <div className="mt-3 relative">
        <video
          ref={videoRef}
          src={videoUrl}          // ✅ ここが重要：親で保持した blob URL を使う
          controls
          className="w-full rounded bg-black"
        />
        <div
          ref={overlayRef}
          className="absolute inset-0 cursor-crosshair"
          onClick={handleOverlayClick}
          title="コーン中心をクリック"
          style={{ pointerEvents: 'auto' }}
        >
          {dots}
        </div>
      </div>
    </div>
  );
};

export const MultiCameraSetup: React.FC<MultiCameraSetupProps> = ({
  athleteId,
  athleteName,
  onStartAnalysis,
  onCancel
}) => {
  const [step, setStep] = useState<Step>('config');

  const [config, setConfig] = useState<MultiCameraConfig>({
    segmentLengthM: 5,
    totalDistanceM: 15,
    fps: 120,
    // @ts-ignore - 既に型に含めている前提（含まれていない場合は multiCameraTypes 側へ追加してください）
    laneWidthM: 1.22,
    // @ts-ignore
    preMarginM: 1,
    // @ts-ignore
    postMarginM: 1
  });

  const [run, setRun] = useState<Run | null>(null);
  const [segments, setSegments] = useState<RunSegment[]>([]);

  // ✅ File を保持
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, File>>(new Map());

  // ✅ blob URL を保持（CalibrationPanel に渡す）
  const [segmentVideoUrls, setSegmentVideoUrls] = useState<Map<string, string>>(new Map());

  // ✅ アンマウント時に blob URL を全解放（メモリリーク防止）
  useEffect(() => {
    return () => {
      segmentVideoUrls.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAllVideoUrls = useCallback(() => {
    setSegmentVideoUrls(prev => {
      prev.forEach(url => {
        try { URL.revokeObjectURL(url); } catch {}
      });
      return new Map();
    });
  }, []);

  // Step 1: Configure run parameters
  const handleConfigSubmit = useCallback(() => {
    // 新規Run開始なので、前のURL/ファイルをクリア
    clearAllVideoUrls();
    setUploadedFiles(new Map());

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
      config.segmentLengthM,
      {
        fps: config.fps,
        // @ts-ignore
        laneWidthM: (config as any).laneWidthM,
        // @ts-ignore
        preMarginM: (config as any).preMarginM,
        // @ts-ignore
        postMarginM: (config as any).postMarginM
      }
    );

    setRun(newRun);
    setSegments(newSegments);
    setStep('upload');
  }, [config, athleteId, athleteName, clearAllVideoUrls]);

  // Step 2: Handle video uploads
  const handleVideoUpload = useCallback((segmentId: string, file: File) => {
    // ① File を保存
    setUploadedFiles(prev => new Map(prev).set(segmentId, file));

    setSegments(prev => prev.map(seg =>
      seg.id === segmentId
        ? { ...seg, videoFile: file, status: 'completed' as const }
        : seg
    ));

    // ② blob URL を作って保持（CalibrationPanel で使う）
    const url = URL.createObjectURL(file);

    setSegmentVideoUrls(prev => {
      const next = new Map(prev);
      const old = next.get(segmentId);
      if (old) {
        try { URL.revokeObjectURL(old); } catch {}
      }
      next.set(segmentId, url);
      return next;
    });
  }, []);

  // Step 3: Save calibration per segment
  const handleSaveCalibration = useCallback((segmentId: string, calibration: SegmentCalibration) => {
    setSegments(prev => prev.map(seg =>
      seg.id === segmentId
        ? { ...seg, calibration }
        : seg
    ));
  }, []);

  // Start analysis
  const handleStartAnalysis = useCallback(() => {
    if (!run) return;

    const laneWidth = (config as any).laneWidthM ?? 1.22;

    const finalSegments = segments.map(seg => ({
      ...seg,
      fps: config.fps,
      // @ts-ignore
      laneWidthM: laneWidth,
      videoFile: uploadedFiles.get(seg.id) ?? seg.videoFile
    }));

    const missingVideos = finalSegments.filter(s => !s.videoFile);
    if (missingVideos.length > 0) {
      alert(`動画がアップロードされていない区間があります: ${missingVideos.map(s => `${s.startDistanceM}-${s.endDistanceM}m`).join(', ')}`);
      return;
    }

    const missingCalib = finalSegments.filter(s => !s.calibration);
    if (missingCalib.length > 0) {
      alert(`キャリブレーション未完了の区間があります: ${missingCalib.map(s => `${s.startDistanceM}-${s.endDistanceM}m`).join(', ')}`);
      return;
    }

    // ✅ onStartAnalysis へは File を渡す（blob URL は渡さない）
    onStartAnalysis(run, finalSegments);
  }, [run, segments, uploadedFiles, onStartAnalysis, config]);

  const allVideosUploaded = segments.length > 0 && segments.every(seg => uploadedFiles.has(seg.id));
  const allCalibrated = segments.length > 0 && segments.every(seg => !!seg.calibration);

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
              <span className="font-medium">2. 動画</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
            <div className={`flex items-center ${step === 'calibrate' ? 'text-blue-600' : 'text-gray-400'}`}>
              <Crosshair className="w-5 h-5 mr-2" />
              <span className="font-medium">3. キャリブ</span>
            </div>
          </div>
        </div>

        {/* Step 1: Configuration */}
        {step === 'config' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-6">マルチカメラ解析設定</h2>

            <div className="space-y-6">
              {/* Marker interval selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  マーカー間隔（コーン間隔）
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[5, 10].map(length => (
                    <button
                      key={length}
                      onClick={() => setConfig(prev => ({ ...prev, segmentLengthM: length, totalDistanceM: length === 5 ? 15 : 30 }))}
                      className={`p-4 border-2 rounded-lg transition ${
                        config.segmentLengthM === length
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xl font-bold">{length}m</div>
                      <div className="text-sm text-gray-500">
                        {length === 5 ? '推奨（精度重視）' : '簡易（設置が楽）'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Total distance selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  総距離（最後のコーン位置）
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
                        {Math.ceil(distance / config.segmentLengthM)}区間（≒カメラ本数）
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

              {/* Lane width + margins */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">レーン幅(m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={(config as any).laneWidthM ?? 1.22}
                    onChange={(e) => setConfig(prev => ({ ...(prev as any), laneWidthM: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <div className="text-xs text-gray-500 mt-1">標準: 1.22</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">前マージン(m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={(config as any).preMarginM ?? 1}
                    onChange={(e) => setConfig(prev => ({ ...(prev as any), preMarginM: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <div className="text-xs text-gray-500 mt-1">例: 1（-1〜6m）</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">後マージン(m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={(config as any).postMarginM ?? 1}
                    onChange={(e) => setConfig(prev => ({ ...(prev as any), postMarginM: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <div className="text-xs text-gray-500 mt-1">例: 1（4〜11m）</div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">設定内容（撮影レンジの目安）</h3>
                <ul className="text-sm space-y-1">
                  <li>• コーン間隔: {config.segmentLengthM}m</li>
                  <li>• 総距離: {config.totalDistanceM}m</li>
                  <li>• fps: {config.fps}</li>
                  <li>• レーン幅: {(config as any).laneWidthM ?? 1.22}m</li>
                  <li>• マージン: 前{(config as any).preMarginM ?? 1}m / 後{(config as any).postMarginM ?? 1}m（重複が作れます）</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    clearAllVideoUrls();
                    onCancel();
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfigSubmit}
                  className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  次へ: 動画アップロード
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Video Upload */}
        {step === 'upload' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-2">セグメント動画のアップロード</h2>
            <div className="text-sm text-gray-600 mb-6">
              各カメラは「区間（x0〜x1）」のコーン2本（手前/奥）が映るように撮影してください。
            </div>

            <div className="space-y-4">
              {segments.map((segment, idx) => {
                const file = uploadedFiles.get(segment.id);
                const prev = idx > 0 ? segments[idx - 1] : null;
                const ov = prev
                  ? intersectRange(prev.captureStartDistanceM, prev.captureEndDistanceM, segment.captureStartDistanceM, segment.captureEndDistanceM)
                  : null;

                return (
                  <div key={segment.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-medium">
                          カメラ {idx + 1}: 解析区間 {segment.startDistanceM}〜{segment.endDistanceM}m
                        </h3>

                        <div className="text-sm text-gray-600 mt-1">
                          推奨撮影範囲: <span className="font-medium">{formatRange(segment.captureStartDistanceM, segment.captureEndDistanceM)}</span>
                        </div>

                        {ov && (
                          <div className="text-xs text-gray-500 mt-1">
                            前カメラとの重複: {formatRange(ov.start, ov.end)}
                          </div>
                        )}

                        {file ? (
                          <div className="flex items-center text-green-600 mt-3">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span className="truncate">{file.name}</span>
                          </div>
                        ) : (
                          <label className="inline-flex items-center mt-3 px-4 py-2 bg-gray-100 rounded cursor-pointer hover:bg-gray-200">
                            <Upload className="w-4 h-4 mr-2" />
                            動画を選択
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleVideoUpload(segment.id, f);
                                // 同じファイルを選び直せるようにクリア
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {file && (
                        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep('config')}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                戻る
              </button>
              <button
                onClick={() => setStep('calibrate')}
                disabled={!allVideosUploaded}
                className={`flex-1 px-6 py-3 rounded-lg flex items-center justify-center ${
                  allVideosUploaded
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Crosshair className="w-4 h-4 mr-2" />
                次へ: キャリブレーション
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Calibration */}
        {step === 'calibrate' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-2">キャリブレーション（コーン4点クリック）</h2>
            <div className="text-sm text-gray-600 mb-6">
              各動画で、{config.segmentLengthM}m間隔の2本のコーン（手前/奥）をクリックして、平面変換を作成します。
            </div>

            <div className="space-y-4">
              {segments.map((segment, idx) => {
                const file = uploadedFiles.get(segment.id);
                const url = segmentVideoUrls.get(segment.id);

                if (!file || !url) return null;

                return (
                  <div key={segment.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium">
                          カメラ {idx + 1}: {segment.startDistanceM}〜{segment.endDistanceM}m
                        </div>
                        <div className="text-xs text-gray-500">
                          撮影範囲目安: {formatRange(segment.captureStartDistanceM, segment.captureEndDistanceM)}
                        </div>
                      </div>

                      {segment.calibration ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          キャリブ完了
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm">未設定</div>
                      )}
                    </div>

                    <CalibrationPanel
                      segment={segment}
                      videoUrl={url}
                      laneWidthM={(config as any).laneWidthM ?? 1.22}
                      onSave={handleSaveCalibration}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                戻る
              </button>

              <button
                onClick={handleStartAnalysis}
                disabled={!allCalibrated}
                className={`flex-1 px-6 py-3 rounded-lg flex items-center justify-center ${
                  allCalibrated
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 mr-2" />
                解析開始
              </button>
            </div>

            {!allCalibrated && (
              <div className="mt-3 text-sm text-gray-600">
                ※ すべての区間で「保存」を押してキャリブ完了にしてから解析を開始してください。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiCameraSetup;
