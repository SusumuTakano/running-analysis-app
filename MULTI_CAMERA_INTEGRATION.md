# マルチカメラモード実装手順

## 概要
App.tsxを最小限の変更で、マルチカメラモードを追加する手順です。
大きなファイルを丸ごと置き換えることなく、差分ベースで実装します。

## 1. 必要なファイルの追加（完了済み）
- `/src/types/multiCamera.ts` - 型定義
- `/src/components/MultiCameraRunSetup.tsx` - マルチカメラ設定UI
- `/src/utils/multiCameraUtils.ts` - データ結合ユーティリティ

## 2. App.tsxへの差分追加

### 2.1 Import文の追加（ファイル先頭、既存のimport文の後）

```typescript
// Line 12あたり、既存のimport文の後に追加
import MultiCameraRunSetup from './components/MultiCameraRunSetup';
import { Run, RunSegment } from './types/multiCamera';
import { combineSegmentSteps, calculateMultiCameraStats } from './utils/multiCameraUtils';
```

### 2.2 型定義の追加（WizardStep型の後）

```typescript
// Line 14あたり、WizardStep型の後に追加
/** 解析モード */
type AnalysisMode = 'single' | 'multi' | 'panning'; // panningは非表示だが保持
```

### 2.3 State変数の追加（Line 492-494あたり、wizardStepとselectedFpsの後）

```typescript
// Line 494のselectedFpsの後に追加
const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('single');
const [currentRun, setCurrentRun] = useState<Run | null>(null);
const [runSegments, setRunSegments] = useState<RunSegment[]>([]);
const [isMultiCameraSetup, setIsMultiCameraSetup] = useState(false);
```

### 2.4 マルチカメラ処理関数の追加（renderStepContent関数の前、Line 5250あたり）

```typescript
  // マルチカメラ解析開始時の処理
  const handleMultiCameraStart = async (run: Run, segments: RunSegment[]) => {
    console.log('マルチカメラ解析開始:', { run, segments });
    
    setCurrentRun(run);
    setRunSegments(segments);
    setIsMultiCameraSetup(false);
    
    // 各セグメントの解析処理
    // TODO: 既存の解析ロジックを呼び出す
    
    // 結果表示へ
    setWizardStep(6);
  };
  
  // セグメント動画を処理する関数
  const processSegmentVideo = async (video: File, segment: RunSegment): Promise<string> => {
    // 既存の解析ロジックを使用
    console.log(`Processing segment ${segment.segmentIndex}:`, video.name);
    
    // TODO: 実際の処理を実装
    // 1. 動画をアップロード
    // 2. フレーム抽出（既存のhandleExtractFrames相当）
    // 3. 姿勢推定（既存のhandlePoseEstimation相当）
    // 4. セッションIDを返す
    
    return `session_${segment.id}`; // 仮のセッションID
  };
```

### 2.5 renderStepContent内のcase 0の修正（Line 5259-5691あたり）

case 0の`次へ：動画アップロード`ボタンの前に、モード選択UIを追加：

```typescript
// Line 5665あたり、</div>の前に追加
          {/* 解析モード選択 */}
          <div style={{
            maxWidth: "600px",
            margin: "24px auto",
            background: "white",
            padding: "32px",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 'bold' }}>
              解析モードを選択
            </h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: analysisMode === 'single' ? '#3b82f6' : '#f3f4f6',
                color: analysisMode === 'single' ? 'white' : '#374151',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}>
                <input
                  type="radio"
                  name="analysisMode"
                  value="single"
                  checked={analysisMode === 'single'}
                  onChange={() => setAnalysisMode('single')}
                  style={{ display: 'none' }}
                />
                📹 シングル固定カメラ
              </label>
              
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: analysisMode === 'multi' ? '#3b82f6' : '#f3f4f6',
                color: analysisMode === 'multi' ? 'white' : '#374151',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}>
                <input
                  type="radio"
                  name="analysisMode"
                  value="multi"
                  checked={analysisMode === 'multi'}
                  onChange={() => setAnalysisMode('multi')}
                  style={{ display: 'none' }}
                />
                📹📹 マルチ固定カメラ
              </label>
            </div>
            
            {analysisMode === 'multi' && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: '#fef3c7',
                borderRadius: '8px',
                fontSize: '0.9rem'
              }}>
                ⚠️ マルチカメラモードでは、10mごとに複数の動画を撮影し、
                結合して解析します。
              </div>
            )}
          </div>
```

### 2.6 「次へ」ボタンのonClick修正（Line 5671あたり）

```typescript
onClick={() => {
  if (analysisMode === 'multi') {
    // マルチカメラモードの場合は専用UIへ
    setIsMultiCameraSetup(true);
  } else {
    // シングルカメラモードは既存フローへ
    setWizardStep(1);
    // チュートリアル表示処理...（既存のコード）
  }
}}
```

### 2.7 renderStepContent関数の先頭に条件分岐追加（Line 5258あたり）

```typescript
const renderStepContent = () => {
  // マルチカメラ設定画面を表示
  if (isMultiCameraSetup) {
    return (
      <MultiCameraRunSetup
        athleteId={selectedAthleteId || undefined}
        onStartAnalysis={handleMultiCameraStart}
        onCancel={() => setIsMultiCameraSetup(false)}
        processSegmentVideo={processSegmentVideo}
      />
    );
  }
  
  // 既存のswitch文
  switch (wizardStep) {
    // ... 既存のコード
```

## 3. 動作確認

1. Step 0で「マルチ固定カメラ」を選択
2. 「次へ」ボタンでMultiCameraRunSetupコンポーネントが表示される
3. 距離を選択し、各セグメントに動画を割り当てる
4. 「解析開始」で各セグメントが処理される

## 4. 今後の実装

### 4.1 processSegmentVideo関数の実装
既存の解析ロジック（handleExtractFrames, handlePoseEstimation等）を
セグメントごとに適用する処理を実装

### 4.2 結果表示の拡張
Step 6（結果表示）で、マルチカメラの場合は結合データを表示する処理を追加

### 4.3 データベース連携
必要に応じて、Run/RunSegmentテーブルをSupabaseに追加

## 注意事項

- 既存のパンカメラモードのコードは削除せず、UIから非表示にするだけ
- 既存の固定カメラ解析ロジックは変更せず、再利用する
- 大きなファイルの全置き換えは行わない