import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface RegisterFormProps {
  onToggleMode: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onToggleMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState<'guest' | 'paid'>('guest');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signUpAsGuest } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (accountType === 'guest') {
        await signUpAsGuest(email, password, fullName);
        setSuccess('ゲストアカウントを作成しました！1週間のトライアルをお楽しみください。確認メールをご確認ください。');
      } else {
        await signUp(email, password, fullName);
        setSuccess('アカウントを作成しました！確認メールをご確認ください。');
      }
      
      // フォームをリセット
      setEmail('');
      setPassword('');
      setFullName('');
    } catch (err: any) {
      setError(err.message || '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">新規登録</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            アカウントタイプ
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="guest"
                checked={accountType === 'guest'}
                onChange={(e) => setAccountType(e.target.value as 'guest')}
                className="mr-2"
              />
              <span>ゲストアカウント（1週間無料トライアル）</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="paid"
                checked={accountType === 'paid'}
                onChange={(e) => setAccountType(e.target.value as 'paid')}
                className="mr-2"
              />
              <span>有料アカウント（年間500円）</span>
            </label>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="fullName">
            お名前
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
            パスワード（6文字以上）
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {accountType === 'guest' && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              ℹ️ ゲストアカウントは1週間無料でお試しいただけます。
              期間終了後は有料プランにアップグレードが必要です。
            </p>
          </div>
        )}

        {accountType === 'paid' && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">
              💳 登録後、Stripe決済画面に移動します（年間500円）
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '登録中...' : '登録する'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={onToggleMode}
          className="text-blue-500 hover:text-blue-600 text-sm"
        >
          すでにアカウントをお持ちの方はこちら
        </button>
      </div>
    </div>
  );
};
