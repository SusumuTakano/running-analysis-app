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

  // 課金チェックを無効化 - 全ユーザーがアクセス可能
  return <>{children}</>;
};
