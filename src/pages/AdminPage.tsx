import React from 'react';
import { AdminLayout } from '../components/Admin/AdminLayout';
import { Dashboard } from '../components/Admin/Dashboard';
import { UserManagement } from '../components/Admin/UserManagement';
import { StripeSettings } from '../components/Admin/StripeSettings';

interface AdminContentProps {
  activeTab?: 'dashboard' | 'users' | 'stripe' | 'subscriptions' | 'settings';
}

const AdminContent: React.FC<AdminContentProps> = ({ activeTab = 'dashboard' }) => {
  switch (activeTab) {
    case 'dashboard':
      return <Dashboard />;
    case 'users':
      return <UserManagement />;
    case 'stripe':
      return <StripeSettings />;
    case 'subscriptions':
      return (
        <div>
          <h2 className="text-2xl font-bold mb-6">サブスクリプション管理</h2>
          <div className="p-8 bg-gray-50 rounded-lg text-center">
            <div className="text-4xl mb-4">🚧</div>
            <p className="text-gray-600">この機能は開発中です</p>
          </div>
        </div>
      );
    case 'settings':
      return (
        <div>
          <h2 className="text-2xl font-bold mb-6">システム設定</h2>
          <div className="space-y-4">
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h3 className="font-semibold mb-2">アプリケーション設定</h3>
              <div className="text-sm text-gray-600">
                アプリ名、サポートメール、その他の基本設定
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <div className="text-4xl mb-4">🚧</div>
              <p className="text-gray-600">この機能は開発中です</p>
            </div>
          </div>
        </div>
      );
    default:
      return <Dashboard />;
  }
};

export const AdminPage: React.FC = () => {
  return (
    <AdminLayout>
      <AdminContent />
    </AdminLayout>
  );
};
