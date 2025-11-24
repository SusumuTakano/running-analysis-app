import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthGuard } from './components/Auth/AuthGuard';
import { AuthPage } from './pages/AuthPage';
import { AdminPage } from './pages/AdminPage';
import App from './App';

type ViewMode = 'app' | 'profile' | 'admin';

// ナビゲーションヘッダー
const Navigation: React.FC<{ viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }> = ({ 
  viewMode, 
  setViewMode 
}) => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-800">
              ランニング動作解析システム
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            
            <button
              onClick={() => setViewMode('app')}
              className={`text-sm ${viewMode === 'app' ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-600'}`}
            >
              分析画面
            </button>
            
            <button
              onClick={() => setViewMode('profile')}
              className={`text-sm ${viewMode === 'profile' ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-600'}`}
            >
              マイページ
            </button>

            {user.role === 'admin' && (
              <button
                onClick={() => setViewMode('admin')}
                className={`text-sm ${viewMode === 'admin' ? 'text-purple-600 font-semibold' : 'text-purple-500 hover:text-purple-600'}`}
              >
                🛡️ 管理画面
              </button>
            )}
            
            <button
              onClick={async () => {
                try {
                  await signOut();
                } catch (error) {
                  console.error('Error signing out:', error);
                }
              }}
              className="text-sm text-red-500 hover:text-red-600"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// メインアプリケーションコンポーネント
const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('app');

  // 未ログインの場合は認証ページを表示
  if (!user) {
    return <AuthPage />;
  }

  // 管理画面を表示（管理者のみ）
  if (viewMode === 'admin' && user.role === 'admin') {
    return <AdminPage />;
  }

  // プロフィールページを表示
  if (viewMode === 'profile') {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation viewMode={viewMode} setViewMode={setViewMode} />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <AuthPage />
        </div>
      </div>
    );
  }

  // ログイン済みの場合は分析アプリを表示（AuthGuardで保護）
  return (
    <AuthGuard requireSubscription={true}>
      <div className="min-h-screen bg-gray-100">
        <Navigation viewMode={viewMode} setViewMode={setViewMode} />
        <App />
      </div>
    </AuthGuard>
  );
};

// 認証プロバイダーでラップしたルートコンポーネント
const AppWithAuth: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default AppWithAuth;
