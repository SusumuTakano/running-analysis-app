import React, { useState, useEffect } from 'react';
import App from './App';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { supabase } from './lib/supabaseClient';
import { registerUser, loginUser, logoutUser, getUserProfile, isDeveloperPeriodValid, type UserProfile, type RegisterData } from './lib/authService';
import type { User } from '@supabase/supabase-js';

type AuthView = 'login' | 'register' | 'app';

const AppWithAuth: React.FC = () => {
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeveloperPeriod, setIsDeveloperPeriod] = useState(true);

  // 初回ロード時: セッションチェック
  useEffect(() => {
    checkSession();
    checkDeveloperPeriod();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const profile = await getUserProfile(session.user.id);
        setUserProfile(profile);
        setCurrentView('app');
      } else {
        setUserProfile(null);
        setCurrentView('login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const profile = await getUserProfile(session.user.id);
        setUserProfile(profile);
        setCurrentView('app');
      }
    } catch (err) {
      console.error('Session check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkDeveloperPeriod = async () => {
    const isValid = await isDeveloperPeriodValid();
    setIsDeveloperPeriod(isValid);
  };

  const handleLogin = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const data = await loginUser(email, password);
      setUser(data.user);
      
      if (data.user) {
        const profile = await getUserProfile(data.user.id);
        setUserProfile(profile);
      }
      
      setCurrentView('app');
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (formData: RegisterData) => {
    setError(null);
    setLoading(true);

    try {
      // デベロッパー期間チェック
      if (!isDeveloperPeriod) {
        setError('デベロッパー版の期間が終了しました');
        setLoading(false);
        return;
      }

      const registeredUser = await registerUser(formData);
      
      // 登録後は自動的にログインされているのでプロフィールを取得
      const profile = await getUserProfile(registeredUser.id);
      setUser(registeredUser);
      setUserProfile(profile);
      setCurrentView('app');
      
      alert('登録が完了しました！デベロッパー版として2025年12月末まで無料でご利用いただけます。');
    } catch (err: any) {
      setError(err.message || '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('ログアウトしますか?')) return;

    try {
      await logoutUser();
      setUser(null);
      setUserProfile(null);
      setCurrentView('login');
    } catch (err: any) {
      alert(err.message || 'ログアウトに失敗しました');
    }
  };

  // ローディング中
  if (loading && !user) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🏃‍♂️</div>
          <div>読み込み中...</div>
        </div>
      </div>
    );
  }

  // ログイン画面
  if (currentView === 'login') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{
          marginBottom: '24px',
          textAlign: 'center',
          color: 'white'
        }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '8px' }}>
            🏃‍♂️ Running Analysis Studio
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
            デベロッパー版 - 2025年12月末まで無料
          </p>
        </div>

        {error && (
          <div style={{
            maxWidth: '400px',
            width: '100%',
            padding: '12px',
            marginBottom: '16px',
            background: '#fee',
            border: '1px solid #f88',
            borderRadius: '8px',
            color: '#c33',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {!isDeveloperPeriod && (
          <div style={{
            maxWidth: '400px',
            width: '100%',
            padding: '12px',
            marginBottom: '16px',
            background: '#fffacd',
            border: '1px solid #ffd700',
            borderRadius: '8px',
            color: '#856404',
            fontSize: '0.9rem'
          }}>
            ⚠️ デベロッパー版の期間が終了しました。新規登録はできません。
          </div>
        )}

        <LoginForm
          onSubmit={handleLogin}
          onRegisterClick={() => {
            if (!isDeveloperPeriod) {
              alert('デベロッパー版の期間が終了しました');
              return;
            }
            setCurrentView('register');
            setError(null);
          }}
        />

        {loading && (
          <div style={{
            marginTop: '16px',
            color: 'white',
            fontSize: '0.9rem'
          }}>
            処理中...
          </div>
        )}
      </div>
    );
  }

  // 登録画面
  if (currentView === 'register') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{
          marginBottom: '24px',
          textAlign: 'center',
          color: 'white'
        }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '8px' }}>
            🏃‍♂️ Running Analysis Studio
          </h1>
        </div>

        {error && (
          <div style={{
            maxWidth: '600px',
            width: '100%',
            padding: '12px',
            marginBottom: '16px',
            background: '#fee',
            border: '1px solid #f88',
            borderRadius: '8px',
            color: '#c33',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <RegisterForm
          onSubmit={handleRegister}
          onCancel={() => {
            setCurrentView('login');
            setError(null);
          }}
        />

        {loading && (
          <div style={{
            marginTop: '16px',
            color: 'white',
            fontSize: '0.9rem'
          }}>
            登録処理中...
          </div>
        )}
      </div>
    );
  }

  // アプリ本体（ログイン済み）
  return (
    <div>
      {/* ユーザー情報バー */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        padding: '12px 20px',
        background: 'rgba(102, 126, 234, 0.9)',
        color: 'white',
        zIndex: 1000,
        borderBottomLeftRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontSize: '0.9rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <span>
          👤 {userProfile?.name || user?.email}
        </span>
        {userProfile && (
          <span style={{ opacity: 0.9 }}>
            身長: {userProfile.height_cm}cm
          </span>
        )}
        <button
          onClick={handleLogout}
          style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          ログアウト
        </button>
      </div>

      {/* アプリ本体 */}
      <App userProfile={userProfile} />
    </div>
  );
};

export default AppWithAuth;
