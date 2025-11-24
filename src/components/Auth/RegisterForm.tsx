import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface RegisterFormProps {
  onToggleMode: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onToggleMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState<'guest' | 'paid'>('guest');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signUpAsGuest } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // バリデーション
    if (!fullName.trim()) {
      setError('お名前を入力してください');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (!agreedToTerms) {
      setError('利用規約に同意してください');
      return;
    }

    setLoading(true);

    try {
      if (accountType === 'guest') {
        await signUpAsGuest(email, password, fullName);
        setSuccess('✅ ゲストアカウントを作成しました！1週間のトライアルをお楽しみください。');
        
        // 5秒後にログインページへ案内
        setTimeout(() => {
          setSuccess('✅ 登録完了！メールを確認して、確認リンクをクリックしてください。その後、ログインできます。');
        }, 2000);
      } else {
        await signUp(email, password, fullName);
        setSuccess('✅ アカウントを作成しました！メールを確認後、Stripe決済ページへ移動します...');
        // TODO: Stripe決済ページへリダイレクト
      }
      
      // フォームをリセット
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setAgreedToTerms(false);
    } catch (err: any) {
      console.error('Registration error:', err);
      
      // より詳細なエラーメッセージ
      let errorMessage = '登録に失敗しました。';
      
      if (err.message?.includes('already registered')) {
        errorMessage = 'このメールアドレスは既に登録されています。ログインしてください。';
      } else if (err.message?.includes('Invalid email')) {
        errorMessage = 'メールアドレスの形式が正しくありません。';
      } else if (err.message?.includes('Password')) {
        errorMessage = 'パスワードは6文字以上で入力してください。';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
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
        <div className="mb-4 p-4 bg-green-100 border-2 border-green-400 text-green-800 rounded-lg">
          <div className="font-semibold mb-1">{success}</div>
          <div className="text-sm mt-2">
            確認メールが送信されました。メール内のリンクをクリックしてアカウントを有効化してください。
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-3">
            アカウントタイプを選択
          </label>
          <div className="space-y-3">
            <label className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition ${
              accountType === 'guest' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-blue-300'
            }`}>
              <input
                type="radio"
                value="guest"
                checked={accountType === 'guest'}
                onChange={(e) => setAccountType(e.target.value as 'guest')}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-semibold text-gray-800">
                  🎁 ゲストアカウント（無料トライアル）
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  1週間無料でお試しいただけます
                </div>
              </div>
            </label>
            <label className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition ${
              accountType === 'paid' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 hover:border-green-300'
            }`}>
              <input
                type="radio"
                value="paid"
                checked={accountType === 'paid'}
                onChange={(e) => setAccountType(e.target.value as 'paid')}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-semibold text-gray-800">
                  💳 有料アカウント（年間500円）
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  すぐに全機能をご利用いただけます
                </div>
              </div>
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

        <div className="mb-4">
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

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
            パスワード（確認）
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {password && confirmPassword && password !== confirmPassword && (
            <p className="mt-1 text-sm text-red-600">パスワードが一致しません</p>
          )}
        </div>

        <div className="mb-6">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 mr-2"
              required
            />
            <span className="text-sm text-gray-700">
              <a href="#" className="text-blue-500 hover:text-blue-600 underline">利用規約</a>
              および
              <a href="#" className="text-blue-500 hover:text-blue-600 underline">プライバシーポリシー</a>
              に同意します
            </span>
          </label>
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
