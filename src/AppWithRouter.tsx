import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthGuard } from './components/Auth/AuthGuard';
import { AuthPage } from './pages/AuthPage';
import { AdminPage } from './pages/AdminPage';
import { AdminLogin } from './components/Admin/AdminLogin';
import App from './App';
import { AppRoute } from './types/routing';

type ViewMode = 'app' | 'profile' | 'admin';

// ナビゲーションヘッダー
const Navigation: React.FC<{ 
  viewMode: ViewMode; 
  setViewMode: (mode: ViewMode) => void;
  onAdminLogout: () => void;
}> = ({ viewMode, setViewMode, onAdminLogout }) => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const isAdmin = user.is_admin || user.role === 'admin';

  const handleLogout = async () => {
    try {
      await signOut();
      onAdminLogout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-800" style={{ letterSpacing: '0.06em' }}>
              ⚡ SPRINT TIMER
            </h1>
            {isAdmin && (
              <span className="ml-3 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                管理者
              </span>
            )}
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

            {isAdmin && (
              <button
                onClick={() => setViewMode('admin')}
                className={`text-sm ${viewMode === 'admin' ? 'text-purple-600 font-semibold' : 'text-purple-500 hover:text-purple-600'}`}
              >
                🛡️ 管理画面
              </button>
            )}
            
            <button
              onClick={handleLogout}
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
  const { user, loading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('app');
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('/');

  // URL変更を監視（簡易的なルーティング）
  useEffect(() => {
    const path = window.location.pathname as AppRoute;
    setCurrentRoute(path);

    // URLが /admin/login の場合
    if (path === '/admin/login') {
      // 既にログイン済みで管理者の場合は管理画面へ
      if (user && (user.is_admin || user.role === 'admin')) {
        window.history.pushState({}, '', '/admin/dashboard');
        setCurrentRoute('/admin/dashboard');
        setViewMode('admin');
      }
    }
  }, [user]);

  const handleNavigation = (route: AppRoute) => {
    window.history.pushState({}, '', route);
    setCurrentRoute(route);
  };

  const handleAdminLoginSuccess = () => {
    handleNavigation('/admin/dashboard');
    setViewMode('admin');
  };

  const handleAdminLogout = () => {
    handleNavigation('/');
    setViewMode('app');
  };

  // ローディング中
  if (loading) {
    console.log('🔄 MainApp: Still loading... (loading=' + loading + ')');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  console.log('✅ MainApp: Loading complete! Showing content...');
  console.log('Current user:', user);
  console.log('Current route:', currentRoute);
  console.log('View mode:', viewMode);

  // 管理者ログインページ（/admin/login）
  if (currentRoute === '/admin/login') {
    if (user && (user.is_admin || user.role === 'admin')) {
      // 既にログイン済みの管理者は管理画面へ
      return <AdminPage />;
    }
    if (user && !user.is_admin && user.role !== 'admin') {
      // ログイン済みだが管理者権限がない場合
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold mb-4 text-red-600">アクセス拒否</h2>
            <p className="text-gray-600 mb-6">
              管理者権限がありません。
              <br />
              一般ユーザーとしてログインしています。
            </p>
            <button
              onClick={handleAdminLogout}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              一般画面に戻る
            </button>
          </div>
        </div>
      );
    }
    // 未ログインの場合は管理者ログインページを表示
    return <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />;
  }

  // 管理画面（/admin/dashboard）
  if (currentRoute === '/admin/dashboard') {
    if (!user) {
      // 未ログインの場合は管理者ログインへ
      handleNavigation('/admin/login');
      return null;
    }
    if (user.is_admin || user.role === 'admin') {
      return <AdminPage />;
    }
    // 管理者権限がない場合
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-red-600">アクセス拒否</h2>
          <p className="text-gray-600 mb-4">
            管理者権限がありません
          </p>
          <button
            onClick={() => handleNavigation('/')}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            トップへ戻る
          </button>
        </div>
      </div>
    );
  }

  // 一般ユーザー画面（/）
  // ログインなしで誰でもアクセス可能に変更
  
  // プロフィールページを表示（ログイン済みのみ）
  if (viewMode === 'profile') {
    if (!user) {
      return <AuthPage />;
    }
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation viewMode={viewMode} setViewMode={setViewMode} onAdminLogout={handleAdminLogout} />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <AuthPage />
        </div>
      </div>
    );
  }

  // 管理画面を表示（ナビゲーションから）
  if (viewMode === 'admin' && user && (user.is_admin || user.role === 'admin')) {
    return <AdminPage />;
  }

  // 分析アプリを表示（ログイン不要 - AuthGuardを削除）
  return (
    <div className="min-h-screen bg-gray-100">
      {user && <Navigation viewMode={viewMode} setViewMode={setViewMode} onAdminLogout={handleAdminLogout} />}
      <App />
    </div>
  );
};

// 認証プロバイダーでラップしたルートコンポーネント
const AppWithRouter: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default AppWithRouter;
