import React, { useState } from 'react';
import { LoginForm } from '../components/Auth/LoginForm';
import { RegisterForm } from '../components/Auth/RegisterForm';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../components/Auth/UserProfile';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { user, loading } = useAuth();

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // ログイン済みの場合はプロフィールを表示
  if (user) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8 text-center">マイページ</h1>
          <UserProfile />
        </div>
      </div>
    );
  }

  // 未ログインの場合はログイン/登録フォームを表示
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">
          ランニング動作解析システム
        </h1>
        
        {mode === 'login' ? (
          <LoginForm onToggleMode={toggleMode} />
        ) : (
          <RegisterForm onToggleMode={toggleMode} />
        )}
      </div>
    </div>
  );
};
