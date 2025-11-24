import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthGuard } from './components/Auth/AuthGuard';
import { AuthPage } from './pages/AuthPage';
import App from './App';

// ナビゲーションヘッダー
const Navigation: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

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
              onClick={() => setShowProfile(!showProfile)}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              {showProfile ? '分析画面' : 'マイページ'}
            </button>
            
            <button
              onClick={async () => {
                try {
                  await signOut();
                } catch (error) {
                  console.error('Error signing out:', error);
                }
              }}
              className="text-sm text-gray-500 hover:text-gray-600"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
      
      {showProfile && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <AuthPage />
        </div>
      )}
    </nav>
  );
};

// メインアプリケーションコンポーネント
const MainApp: React.FC = () => {
  const { user } = useAuth();

  // 未ログインの場合は認証ページを表示
  if (!user) {
    return <AuthPage />;
  }

  // ログイン済みの場合は分析アプリを表示（AuthGuardで保護）
  return (
    <AuthGuard requireSubscription={true}>
      <div className="min-h-screen bg-gray-100">
        <Navigation />
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
