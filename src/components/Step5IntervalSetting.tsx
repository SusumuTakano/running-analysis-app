import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type Roi = {
  x: number;      // canvas 座標（px）
  y: number;
  width: number;
  height: number;
};

export type PoseCheckResult = {
  frame: number;
  ok: boolean;
};

type Step5IntervalSettingProps = {
  videoUrl: string;
  fps: number;
  totalFrames: number;

  // スタート・フィニッシュ・中間の初期値
  startFrame: number;
  finishFrame: number;
  midFrame?: number;

  // 親へ変更を伝えるコールバック
  onChangeStartFrame?: (frame: number, poseOk: boolean) => void;
  onChangeFinishFrame?: (frame: number, poseOk: boolean) => void;
  onChangeMidFrame?: (frame: number) => void;

  // 「このフレームで姿勢をチェックしてほしい」関数
  // ※ すでに実装済みの姿勢推定ロジックをここに渡してください
  estimatePose: (frame: number, roi?: Roi | null) => Promise<boolean>;
  
  // 姿勢推定結果の取得
  getPoseAtFrame?: (frame: number) => any;
  
  // 次へ進むボタンのコールバック
  onNext?: () => void;
};

const Step5IntervalSetting: React.FC<Step5IntervalSettingProps> = ({
  videoUrl,
  fps,
  totalFrames,
  startFrame,
  finishFrame,
  midFrame,
  onChangeStartFrame,
  onChangeFinishFrame,
  onChangeMidFrame,
  estimatePose,
  getPoseAtFrame,
  onNext,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 表示中のフレーム
  const [currentFrame, setCurrentFrame] = useState<number>(startFrame);
  const [internalStartFrame, setInternalStartFrame] = useState<number>(startFrame);
  const [internalFinishFrame, setInternalFinishFrame] = useState<number>(finishFrame);
  const [internalMidFrame, setInternalMidFrame] = useState<number>(midFrame || Math.floor((startFrame + finishFrame) / 2));

  // 姿勢が認識できているか
  const [startPoseOk, setStartPoseOk] = useState<boolean>(true);
  const [finishPoseOk, setFinishPoseOk] = useState<boolean>(true);

  // 手動人物指定
  const [manualRoi, setManualRoi] = useState<Roi | null>(null);
  const [isSelectingPerson, setIsSelectingPerson] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [selectingFor, setSelectingFor] = useState<'start' | 'finish' | null>(null);

  // -------------- 動画の準備と canvas サイズ合わせ -------------- //

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const handleLoaded = () => {
      // 内部解像度を video に合わせる
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      // 最初のフレームを描画
      seekAndDraw(internalStartFrame);
      // 初期チェック
      checkPoseAtFrames();
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  // -------------- 姿勢チェック -------------- //
  const checkPoseAtFrames = async () => {
    const startOk = await estimatePose(internalStartFrame, null);
    const finishOk = await estimatePose(internalFinishFrame, null);
    setStartPoseOk(startOk);
    setFinishPoseOk(finishOk);
  };

  // -------------- 指定フレームへジャンプして描画 -------------- //

  const drawFrameToCanvas = useCallback(
    (frame: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 背景をクリアして動画を描画
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 姿勢データがあればスケルトンを描画
      if (getPoseAtFrame) {
        const pose = getPoseAtFrame(frame);
        if (pose?.landmarks) {
          // 腰の位置から垂直線を描画
          const leftHip = pose.landmarks[23];
          const rightHip = pose.landmarks[24];
          if (leftHip && rightHip) {
            const hipX = ((leftHip.x + rightHip.x) / 2) * canvas.width;
            
            // スタート線
            if (frame === internalStartFrame) {
              ctx.strokeStyle = "#00ff88";
              ctx.lineWidth = 3;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(hipX, 0);
              ctx.lineTo(hipX, canvas.height);
              ctx.stroke();
              
              ctx.fillStyle = "#00ff88";
              ctx.font = "bold 20px sans-serif";
              ctx.fillText("START", hipX + 10, 30);
            }
            
            // フィニッシュ線
            if (frame === internalFinishFrame) {
              ctx.strokeStyle = "#ff4444";
              ctx.lineWidth = 3;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(hipX, 0);
              ctx.lineTo(hipX, canvas.height);
              ctx.stroke();
              
              ctx.fillStyle = "#ff4444";
              ctx.font = "bold 20px sans-serif";
              ctx.fillText("FINISH", hipX + 10, 30);
            }
            
            // 中間線
            if (frame === internalMidFrame) {
              ctx.strokeStyle = "#ffaa00";
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 5]);
              ctx.beginPath();
              ctx.moveTo(hipX, 0);
              ctx.lineTo(hipX, canvas.height);
              ctx.stroke();
              
              ctx.fillStyle = "#ffaa00";
              ctx.font = "bold 20px sans-serif";
              ctx.fillText("MID", hipX + 10, 60);
            }
          }
        }
      }

      // 手動指定の ROI を描画
      if (manualRoi) {
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          manualRoi.x,
          manualRoi.y,
          manualRoi.width,
          manualRoi.height
        );
        
        // 半透明の背景
        ctx.fillStyle = "rgba(0, 255, 136, 0.1)";
        ctx.fillRect(
          manualRoi.x,
          manualRoi.y,
          manualRoi.width,
          manualRoi.height
        );
        ctx.setLineDash([]);
      }
    },
    [manualRoi, internalStartFrame, internalFinishFrame, internalMidFrame, getPoseAtFrame]
  );

  const seekAndDraw = useCallback(
    (frame: number) => {
      const video = videoRef.current;
      if (!video || !fps) return;

      const time = frame / fps;
      // currentTime をセット → seeked イベントで描画
      const handleSeeked = () => {
        drawFrameToCanvas(frame);
        video.removeEventListener("seeked", handleSeeked);
      };
      video.addEventListener("seeked", handleSeeked);
      video.currentTime = time;
    },
    [drawFrameToCanvas, fps]
  );

  // currentFrame が変わったら動画を更新
  useEffect(() => {
    seekAndDraw(currentFrame);
  }, [currentFrame, seekAndDraw]);

  // -------------- スライダー変更時 -------------- //

  const handleChangeStartSlider = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const frame = Number(e.target.value);
    setInternalStartFrame(frame);
    setCurrentFrame(frame);
    setManualRoi(null); // ROI はリセット

    const ok = await estimatePose(frame, null);
    setStartPoseOk(ok);
    onChangeStartFrame && onChangeStartFrame(frame, ok);
  };

  const handleChangeFinishSlider = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const frame = Number(e.target.value);
    setInternalFinishFrame(frame);
    setCurrentFrame(frame);
    setManualRoi(null);

    const ok = await estimatePose(frame, null);
    setFinishPoseOk(ok);
    onChangeFinishFrame && onChangeFinishFrame(frame, ok);
  };
  
  const handleChangeMidSlider = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const frame = Number(e.target.value);
    setInternalMidFrame(frame);
    setCurrentFrame(frame);
    onChangeMidFrame && onChangeMidFrame(frame);
  };

  // -------------- キャンバス上での人物手動指定 -------------- //

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSelectingPerson) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setDragStart({ x, y });
    setManualRoi({ x, y, width: 0, height: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSelectingPerson || !dragStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const x0 = Math.min(dragStart.x, x);
    const y0 = Math.min(dragStart.y, y);
    const x1 = Math.max(dragStart.x, x);
    const y1 = Math.max(dragStart.y, y);

    const roi = {
      x: x0,
      y: y0,
      width: x1 - x0,
      height: y1 - y0,
    };
    
    setManualRoi(roi);
    // リアルタイムで描画更新
    drawFrameToCanvas(currentFrame);
  };

  const handlePointerUp = async () => {
    if (!isSelectingPerson || !manualRoi) return;
    setIsSelectingPerson(false);
    setDragStart(null);

    // 最小サイズチェック
    if (manualRoi.width < 20 || manualRoi.height < 20) {
      setManualRoi(null);
      return;
    }

    // ROI を使ってもう一度姿勢推定
    const ok = await estimatePose(currentFrame, manualRoi);
    
    if (selectingFor === 'start') {
      setStartPoseOk(ok);
      onChangeStartFrame && onChangeStartFrame(internalStartFrame, ok);
    } else if (selectingFor === 'finish') {
      setFinishPoseOk(ok);
      onChangeFinishFrame && onChangeFinishFrame(internalFinishFrame, ok);
    }
    
    setSelectingFor(null);
    
    // 成功したらROI表示を消す
    if (ok) {
      setManualRoi(null);
    }
  };

  // -------------- JSX -------------- //

  return (
    <div className="wizard-content">
      <div className="wizard-step-header">
        <h2 className="wizard-step-title">ステップ 5: 区間設定</h2>
        <p className="wizard-step-desc">
          スライダーを動かして、スタート・フィニッシュ・中間地点を設定してください。
        </p>
      </div>

      {/* 非表示の video（描画用） */}
      <video
        ref={videoRef}
        src={videoUrl}
        style={{ display: "none" }}
        playsInline
        muted
      />

      {/* 表示用 canvas：動画＋スタート線＋人物枠をここに全部描く */}
      <div className="video-wrapper" style={{ cursor: isSelectingPerson ? 'crosshair' : 'default' }}>
        <canvas
          ref={canvasRef}
          className="video-layer"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        {isSelectingPerson && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#00ff88',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            zIndex: 11,
            pointerEvents: 'none',
          }}>
            🎯 ドラッグして人物を囲んでください
          </div>
        )}
      </div>

      <div style={{
        background: '#f9fafb',
        padding: '2rem',
        borderRadius: '12px',
        border: '2px solid #e5e7eb',
        marginTop: '2rem'
      }}>
        <h3 style={{
          fontSize: '1.2rem',
          fontWeight: 'bold',
          marginBottom: '1.5rem',
          color: '#374151',
          textAlign: 'center'
        }}>
          ✨ スライダーで区間を設定
        </h3>

        {/* スタート地点 */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '0.5rem',
            alignItems: 'center'
          }}>
            <span style={{ 
              fontSize: '1rem', 
              fontWeight: 'bold',
              color: '#10b981'
            }}>
              🟢 スタート地点
            </span>
            <span style={{ 
              fontSize: '0.95rem',
              color: '#6b7280',
              background: '#e5e7eb',
              padding: '4px 12px',
              borderRadius: '6px',
              fontWeight: 'bold'
            }}>
              Frame: {internalStartFrame}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={internalStartFrame}
            onChange={handleChangeStartSlider}
            className="section-slider start-slider"
            style={{ width: '100%' }}
          />
          {!startPoseOk && (
            <div style={{
              fontSize: '0.85rem',
              color: '#dc2626',
              marginTop: '0.75rem',
              padding: '10px 14px',
              background: '#fee2e2',
              borderRadius: '8px',
              border: '2px solid #fca5a5',
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              ⚠️ このフレームで姿勢が認識されていません<br/>
              <button
                onClick={() => {
                  setCurrentFrame(internalStartFrame);
                  setSelectingFor('start');
                  setIsSelectingPerson(true);
                  setManualRoi(null);
                }}
                style={{
                  marginTop: '8px',
                  padding: '6px 16px',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                人物を手動で選択
              </button>
            </div>
          )}
        </div>

        {/* フィニッシュ地点 */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '0.5rem',
            alignItems: 'center'
          }}>
            <span style={{ 
              fontSize: '1rem', 
              fontWeight: 'bold',
              color: '#ef4444'
            }}>
              🔴 フィニッシュ地点
            </span>
            <span style={{ 
              fontSize: '0.95rem',
              color: '#6b7280',
              background: '#e5e7eb',
              padding: '4px 12px',
              borderRadius: '6px',
              fontWeight: 'bold'
            }}>
              Frame: {internalFinishFrame}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={internalFinishFrame}
            onChange={handleChangeFinishSlider}
            className="section-slider end-slider"
            style={{ width: '100%' }}
          />
          {!finishPoseOk && (
            <div style={{
              fontSize: '0.85rem',
              color: '#dc2626',
              marginTop: '0.75rem',
              padding: '10px 14px',
              background: '#fee2e2',
              borderRadius: '8px',
              border: '2px solid #fca5a5',
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              ⚠️ このフレームで姿勢が認識されていません<br/>
              <button
                onClick={() => {
                  setCurrentFrame(internalFinishFrame);
                  setSelectingFor('finish');
                  setIsSelectingPerson(true);
                  setManualRoi(null);
                }}
                style={{
                  marginTop: '8px',
                  padding: '6px 16px',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                人物を手動で選択
              </button>
            </div>
          )}
        </div>

        {/* 中間地点 */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '0.5rem',
            alignItems: 'center'
          }}>
            <span style={{ 
              fontSize: '1rem', 
              fontWeight: 'bold',
              color: '#f59e0b'
            }}>
              🟡 中間地点（任意）
            </span>
            <span style={{ 
              fontSize: '0.95rem',
              color: '#6b7280',
              background: '#e5e7eb',
              padding: '4px 12px',
              borderRadius: '6px',
              fontWeight: 'bold'
            }}>
              Frame: {internalMidFrame}
            </span>
          </div>
          <input
            type="range"
            min={internalStartFrame}
            max={internalFinishFrame}
            value={internalMidFrame}
            onChange={handleChangeMidSlider}
            className="section-slider mid-slider"
            style={{ width: '100%' }}
          />
        </div>

        {/* 選択範囲の表示 */}
        <div style={{
          background: '#e0f2fe',
          padding: '12px',
          borderRadius: '8px',
          marginTop: '1rem',
          textAlign: 'center'
        }}>
          <strong>選択範囲: {internalFinishFrame - internalStartFrame} フレーム</strong>
        </div>
      </div>

      {/* ナビゲーション */}
      <div className="wizard-nav" style={{ marginTop: '2rem' }}>
        <button 
          className="btn-secondary"
          onClick={() => window.history.back()}
        >
          ← 戻る
        </button>
        <button 
          className="btn-primary-large"
          onClick={onNext}
        >
          選択範囲: {internalFinishFrame - internalStartFrame} フレーム →
        </button>
      </div>
    </div>
  );
};

export default Step5IntervalSetting;