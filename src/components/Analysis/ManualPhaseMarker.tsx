/**
 * 手動フェーズマーキングコンポーネント
 */

import React, { useState, useRef, useEffect } from 'react';
import { ManualPhaseMarking, VideoMetadata, SupportSide } from '../../types/manual-analysis';
import {
  createMarking,
  validateMarking,
  isOverlapping,
  exportMarkings,
  importMarkings,
  frameToTime
} from '../../utils/manual-phase-marker';

interface ManualPhaseMarkerProps {
  videoFile: File | null;
  onMarkingsChange: (markings: ManualPhaseMarking[]) => void;
}

export const ManualPhaseMarker: React.FC<ManualPhaseMarkerProps> = ({
  videoFile,
  onMarkingsChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [markings, setMarkings] = useState<ManualPhaseMarking[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // マーキング入力フォーム
  const [contactFrame, setContactFrame] = useState<number>(0);
  const [toeOffFrame, setToeOffFrame] = useState<number>(0);
  const [supportSide, setSupportSide] = useState<SupportSide>('right');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  
  // 動画読み込み
  useEffect(() => {
    if (!videoFile || !videoRef.current) return;
    
    const video = videoRef.current;
    const url = URL.createObjectURL(videoFile);
    video.src = url;
    
    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        file_path: url,
        file_name: videoFile.name,
        total_frames: Math.floor(video.duration * 30), // 仮定: 30fps
        fps: 30, // 正確なFPSは取得できないため仮定
        width: video.videoWidth,
        height: video.videoHeight,
        duration_seconds: video.duration
      };
      
      setVideoMetadata(metadata);
      
      if (canvasRef.current) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
      }
    };
    
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [videoFile]);
  
  // フレーム描画
  const drawFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
  };
  
  // 指定フレームに移動
  const seekToFrame = (frame: number) => {
    if (!videoRef.current || !videoMetadata) return;
    
    const time = frameToTime(frame, videoMetadata.fps);
    videoRef.current.currentTime = time;
    setCurrentFrame(frame);
    
    // フレーム描画のために少し待つ
    setTimeout(drawFrame, 100);
  };
  
  // 再生/一時停止
  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  // 1フレーム進む
  const nextFrame = () => {
    if (!videoMetadata) return;
    seekToFrame(Math.min(currentFrame + 1, videoMetadata.total_frames - 1));
  };
  
  // 1フレーム戻る
  const previousFrame = () => {
    seekToFrame(Math.max(currentFrame - 1, 0));
  };
  
  // マーキング追加
  const addMarking = () => {
    setError('');
    
    // バリデーション
    const tempMarking = {
      contact_frame: contactFrame,
      toe_off_frame: toeOffFrame,
      support_side: supportSide
    };
    
    const validation = validateMarking(tempMarking, videoMetadata || undefined);
    
    if (!validation.is_valid) {
      setError(validation.message);
      return;
    }
    
    // マーキング作成
    const newMarking = createMarking(contactFrame, toeOffFrame, supportSide, notes);
    
    // 重複チェック
    for (const existing of markings) {
      if (isOverlapping(newMarking, existing)) {
        setError(`既存のマーキング（ID: ${existing.marking_id}）と重複しています`);
        return;
      }
    }
    
    const updatedMarkings = [...markings, newMarking];
    setMarkings(updatedMarkings);
    onMarkingsChange(updatedMarkings);
    
    // フォームリセット
    setNotes('');
    setError('');
    
    alert('マーキングを追加しました');
  };
  
  // マーキング削除
  const removeMarking = (marking_id: string) => {
    const updatedMarkings = markings.filter(m => m.marking_id !== marking_id);
    setMarkings(updatedMarkings);
    onMarkingsChange(updatedMarkings);
  };
  
  // 現在フレームを接地に設定
  const setAsContact = () => {
    setContactFrame(currentFrame);
  };
  
  // 現在フレームを離地に設定
  const setAsToeOff = () => {
    setToeOffFrame(currentFrame);
  };
  
  // エクスポート
  const handleExport = () => {
    if (!videoMetadata) return;
    
    const json = exportMarkings(markings, videoMetadata);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `markings_${videoMetadata.file_name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // インポート
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json_string = e.target?.result as string;
        const { markings: imported } = importMarkings(json_string);
        setMarkings(imported);
        onMarkingsChange(imported);
        alert(`${imported.length}件のマーキングをインポートしました`);
      } catch (err) {
        alert('インポートに失敗しました');
      }
    };
    reader.readAsText(file);
  };
  
  if (!videoFile) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <p className="text-gray-600">動画を選択してください</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* 動画表示エリア */}
      <div className="bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="hidden"
          onTimeUpdate={() => {
            if (videoRef.current && videoMetadata) {
              const frame = Math.floor(videoRef.current.currentTime * videoMetadata.fps);
              setCurrentFrame(frame);
              drawFrame();
            }
          }}
        />
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
        />
      </div>
      
      {/* 動画コントロール */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            フレーム: {currentFrame} / {videoMetadata?.total_frames || 0}
            {videoMetadata && ` (${frameToTime(currentFrame, videoMetadata.fps).toFixed(2)}秒)`}
          </div>
          <div className="space-x-2">
            <button
              onClick={previousFrame}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              ← 前
            </button>
            <button
              onClick={togglePlay}
              className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {isPlaying ? '⏸ 一時停止' : '▶ 再生'}
            </button>
            <button
              onClick={nextFrame}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              次 →
            </button>
          </div>
        </div>
        
        <input
          type="range"
          min="0"
          max={videoMetadata?.total_frames || 100}
          value={currentFrame}
          onChange={(e) => seekToFrame(parseInt(e.target.value))}
          className="w-full"
        />
      </div>
      
      {/* マーキング入力フォーム */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">フェーズマーキング</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-bold mb-2">接地フレーム</label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={contactFrame}
                onChange={(e) => setContactFrame(parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                onClick={setAsContact}
                className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                現在
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold mb-2">離地フレーム</label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={toeOffFrame}
                onChange={(e) => setToeOffFrame(parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                onClick={setAsToeOff}
                className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                現在
              </button>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-bold mb-2">支持脚</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="right"
                checked={supportSide === 'right'}
                onChange={(e) => setSupportSide(e.target.value as SupportSide)}
                className="mr-2"
              />
              右脚
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="left"
                checked={supportSide === 'left'}
                onChange={(e) => setSupportSide(e.target.value as SupportSide)}
                className="mr-2"
              />
              左脚
            </label>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-bold mb-2">メモ（任意）</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            rows={2}
            placeholder="例: 1回目の右脚接地"
          />
        </div>
        
        <button
          onClick={addMarking}
          className="w-full px-4 py-2 bg-blue-500 text-white font-bold rounded hover:bg-blue-600"
        >
          マーキングを追加
        </button>
      </div>
      
      {/* マーキングリスト */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">マーキング一覧 ({markings.length}件)</h3>
          <div className="space-x-2">
            <button
              onClick={handleExport}
              disabled={markings.length === 0}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              エクスポート
            </button>
            <label className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 cursor-pointer inline-block">
              インポート
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
        
        {markings.length === 0 ? (
          <p className="text-gray-500 text-center py-4">マーキングがありません</p>
        ) : (
          <div className="space-y-2">
            {markings.map((marking, index) => (
              <div
                key={marking.marking_id}
                className="p-4 border rounded hover:bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold">
                      #{index + 1} - {marking.support_side === 'right' ? '右脚' : '左脚'}支持
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      接地: フレーム{marking.contact_frame} → 離地: フレーム{marking.toe_off_frame}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      接地前半: {marking.early_contact_frame} / 
                      中判: {marking.mid_stance_frame} / 
                      離地直前: {marking.pre_toe_off_frame}
                    </div>
                    {marking.notes && (
                      <div className="text-sm text-gray-600 mt-1 italic">
                        {marking.notes}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeMarking(marking.marking_id)}
                    className="ml-4 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
