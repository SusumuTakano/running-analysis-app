import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('ErrorBoundary caught error:', error);
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary details:', {
      error: error.toString(),
      errorInfo: errorInfo.componentStack,
      message: error.message,
      stack: error.stack
    });

    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <div style={{
            maxWidth: '600px',
            background: 'rgba(255,255,255,0.1)',
            padding: '30px',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)'
          }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>
              ⚠️ エラーが発生しました
            </h1>
            
            <p style={{ marginBottom: '15px', fontSize: '1.1rem' }}>
              アプリの初期化中に問題が発生しました。
            </p>

            {this.state.error && (
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                overflowX: 'auto'
              }}>
                <strong>エラー詳細:</strong>
                <pre style={{ marginTop: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.8 }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div style={{ marginBottom: '15px' }}>
              <strong>対処方法:</strong>
              <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                <li>ページをリロードする</li>
                <li>ブラウザのキャッシュをクリアする</li>
                <li>プライベートブラウジングモードで試す</li>
              </ul>
            </div>

            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '12px',
                background: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ページをリロード
            </button>

            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                color: 'white',
                border: '2px solid white',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              再試行
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
