import React, { useState } from 'react';
import './App.css';

export const AppMobile: React.FC = () => {
  const [step, setStep] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '10px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  };

  const headerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '50px',
    background: '#2d3748',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '16px',
    fontWeight: 'bold',
    zIndex: 1000,
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
  };

  const contentStyle: React.CSSProperties = {
    marginTop: '60px',
    background: 'white',
    borderRadius: '10px',
    padding: '20px',
    maxWidth: '100%',
    margin: '60px auto 20px'
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '15px',
    background: '#4a5568',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    marginTop: '15px'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    marginTop: '10px',
    boxSizing: 'border-box'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        🏃 ランニング分析
      </div>
      
      <div style={contentStyle}>
        {step === 0 && (
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>
              ステップ 1: 動画選択
            </h2>
            
            <div>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                ランニング動画を選択：
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setVideoFile(e.target.files[0]);
                  }
                }}
                style={inputStyle}
              />
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                走行距離 (m)：
              </label>
              <input
                type="number"
                placeholder="例: 10"
                style={inputStyle}
              />
            </div>

            <button
              onClick={() => setStep(1)}
              style={buttonStyle}
              disabled={!videoFile}
            >
              次へ進む
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>
              ステップ 2: 解析中
            </h2>
            
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>
                ⏳
              </div>
              <p style={{ fontSize: '16px', color: '#666' }}>
                解析処理中です...<br />
                しばらくお待ちください
              </p>
            </div>

            <button
              onClick={() => setStep(0)}
              style={{ ...buttonStyle, background: '#e53e3e' }}
            >
              戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppMobile;