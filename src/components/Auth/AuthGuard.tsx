import React, { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StripeCheckout } from '../Payment/StripeCheckout';

interface AuthGuardProps {
  children: ReactNode;
  requireSubscription?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  requireSubscription = true 
}) => {
  const { user, loading, isSubscriptionActive, isTrialExpired, daysLeftInTrial } = useAuth();

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
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">ログインが必要です</h2>
          <p className="text-gray-600 mb-4">
            この機能を使用するにはログインしてください
          </p>
        </div>
      </div>
    );
  }

  // サブスクリプション不要の場合はそのまま表示
  if (!requireSubscription) {
    return <>{children}</>;
  }

  // 管理者は常にアクセス可能
  if (user.role === 'admin') {
    return <>{children}</>;
  }

  // 有料会員でサブスクリプションがアクティブ
  if (user.role === 'paid' && isSubscriptionActive()) {
    return <>{children}</>;
  }

  // ゲストでトライアル期間内
  if (user.role === 'guest' && !isTrialExpired()) {
    const daysLeft = daysLeftInTrial();
    return (
      <>
        {/* トライアル期間の警告バナー */}
        <div className="bg-yellow-50 border-b border-yellow-200 p-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="text-sm text-yellow-800">
              🕐 トライアル残り<strong>{daysLeft}日</strong>です。
              引き続き利用するには有料プランへのアップグレードが必要です。
            </span>
            <button className="bg-yellow-500 text-white px-4 py-1 rounded text-sm hover:bg-yellow-600">
              アップグレード
            </button>
          </div>
        </div>
        {children}
      </>
    );
  }

  // アクセス不可（トライアル期限切れ、またはサブスクリプション未契約）
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4 text-red-600">
            アクセスが制限されています
          </h2>
          
          {user.role === 'guest' && isTrialExpired() && (
            <p className="text-gray-600 mb-4">
              トライアル期間が終了しました。
              引き続きご利用いただくには、有料プランへのアップグレードが必要です。
            </p>
          )}

          {user.role === 'paid' && !isSubscriptionActive() && (
            <p className="text-gray-600 mb-4">
              サブスクリプションが有効ではありません。
              継続してご利用いただくには、サブスクリプションの契約が必要です。
            </p>
          )}
        </div>

        <StripeCheckout />
      </div>
    </div>
  );
};
