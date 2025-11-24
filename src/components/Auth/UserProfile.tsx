import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const UserProfile: React.FC = () => {
  const { user, signOut, isSubscriptionActive, isTrialExpired, daysLeftInTrial } = useAuth();

  if (!user) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getRoleBadge = () => {
    switch (user.role) {
      case 'admin':
        return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">管理者</span>;
      case 'paid':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">有料会員</span>;
      case 'guest':
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">ゲスト</span>;
      default:
        return null;
    }
  };

  const getSubscriptionStatus = () => {
    if (user.role === 'admin') {
      return <span className="text-green-600">✓ フルアクセス</span>;
    }

    if (user.role === 'paid') {
      if (isSubscriptionActive()) {
        return <span className="text-green-600">✓ サブスクリプション有効</span>;
      } else {
        return <span className="text-red-600">⚠ サブスクリプション未契約</span>;
      }
    }

    if (user.role === 'guest') {
      if (isTrialExpired()) {
        return <span className="text-red-600">⚠ トライアル期間終了</span>;
      } else {
        const daysLeft = daysLeftInTrial();
        return (
          <span className="text-orange-600">
            🕐 トライアル残り{daysLeft}日
          </span>
        );
      }
    }

    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold">{user.full_name || 'ユーザー'}</h3>
          <p className="text-gray-600 text-sm">{user.email}</p>
        </div>
        {getRoleBadge()}
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-700 mb-2">
          <strong>ステータス:</strong> {getSubscriptionStatus()}
        </div>
      </div>

      {user.role === 'guest' && !isTrialExpired() && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            トライアル期間中です。有料プランにアップグレードして、
            引き続きすべての機能をご利用ください。
          </p>
          <button className="mt-2 bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600">
            有料プランにアップグレード
          </button>
        </div>
      )}

      {user.role === 'guest' && isTrialExpired() && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-800 mb-2">
            トライアル期間が終了しました。有料プランへのアップグレードが必要です。
          </p>
          <button className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600">
            今すぐアップグレード
          </button>
        </div>
      )}

      <button
        onClick={handleSignOut}
        className="w-full bg-gray-500 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-600"
      >
        ログアウト
      </button>
    </div>
  );
};
