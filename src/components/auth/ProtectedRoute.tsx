import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireSubscription?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false,
  requireSubscription = false 
}) => {
  const { user, loading, isSubscriptionActive, isTrialExpired } = useAuth();

  // ローディング中
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

  // 未ログイン
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 管理者権限が必要な場合
  if (requireAdmin && !user.is_admin && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold mb-4 text-red-600">アクセス拒否</h2>
          <p className="text-gray-600 mb-6">
            管理者権限が必要です。
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  // サブスクリプションが必要な場合
  if (requireSubscription) {
    // ゲストユーザーでトライアル期限が切れている場合
    if (user.role === 'guest' && isTrialExpired()) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
            <div className="text-6xl mb-4">⏰</div>
            <h2 className="text-2xl font-bold mb-4 text-orange-600">トライアル期限切れ</h2>
            <p className="text-gray-600 mb-6">
              無料トライアル期間が終了しました。
              <br />
              有料プランに登録して続けてご利用ください。
            </p>
            <button
              onClick={() => window.location.href = '/subscription'}
              className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              有料プランを見る
            </button>
          </div>
        </div>
      );
    }

    // 有料会員でサブスクリプションが無効な場合
    if (user.role === 'paid' && !isSubscriptionActive()) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
            <div className="text-6xl mb-4">💳</div>
            <h2 className="text-2xl font-bold mb-4 text-red-600">サブスクリプションが無効</h2>
            <p className="text-gray-600 mb-6">
              サブスクリプションの更新が必要です。
              <br />
              お支払い情報をご確認ください。
            </p>
            <button
              onClick={() => window.location.href = '/subscription'}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              支払い情報を確認
            </button>
          </div>
        </div>
      );
    }
  }

  // すべての条件をクリアしたら、子要素を表示
  return <>{children}</>;
};