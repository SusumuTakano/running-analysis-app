import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

type AdminTab = 'dashboard' | 'users' | 'stripe' | 'subscriptions' | 'settings';

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // 管理者以外はアクセス不可
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-red-600">アクセス拒否</h2>
          <p className="text-gray-600">
            この画面にアクセスする権限がありません
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'ダッシュボード', icon: '📊' },
    { id: 'users', label: 'ユーザー管理', icon: '👥' },
    { id: 'stripe', label: 'Stripe設定', icon: '💳' },
    { id: 'subscriptions', label: 'サブスクリプション', icon: '📋' },
    { id: 'settings', label: 'システム設定', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">管理画面</h1>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                管理者
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* サイドバーナビゲーション */}
          <aside className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow-md p-4">
              <ul className="space-y-2">
                {tabs.map((tab) => (
                  <li key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-500 text-white font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="mr-3">{tab.icon}</span>
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* メインコンテンツエリア */}
          <main className="flex-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              {React.cloneElement(children as React.ReactElement, { activeTab })}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
