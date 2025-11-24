import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ログイン
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // プロフィールを取得して管理者権限を確認
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin, role')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      // 管理者権限がない場合はエラー
      if (!profile.is_admin && profile.role !== 'admin') {
        // ログアウト
        await supabase.auth.signOut();
        throw new Error('管理者権限がありません');
      }

      // ログイン成功
      onLoginSuccess();
    } catch (err: any) {
      console.error('Admin login error:', err);
      setError(err.message || '管理者ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      <div className="max-w-md w-full mx-4">
        {/* ロゴエリア */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
            <span className="text-4xl">🛡️</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">管理者ログイン</h1>
          <p className="text-purple-200">ランニング動作解析システム</p>
        </div>

        {/* ログインフォーム */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
              <div className="flex items-center">
                <span className="text-xl mr-2">⚠️</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                管理者メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="admin@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  認証中...
                </span>
              ) : (
                '管理画面にログイン'
              )}
            </button>
          </form>

          {/* フッター */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center text-sm text-gray-600">
              <span className="mr-2">👤</span>
              <a href="/" className="text-purple-600 hover:text-purple-700 font-medium">
                一般ユーザーとしてログイン
              </a>
            </div>
          </div>
        </div>

        {/* セキュリティ注意書き */}
        <div className="mt-6 text-center text-purple-200 text-sm">
          <p className="flex items-center justify-center">
            <span className="mr-2">🔒</span>
            このページは管理者専用です
          </p>
        </div>
      </div>
    </div>
  );
};
