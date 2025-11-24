import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AdminStats } from '../../types/admin';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    guestUsers: 0,
    paidUsers: 0,
    adminUsers: 0,
    activeSubscriptions: 0,
    expiredTrials: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // ユーザー統計を取得
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('role, trial_end_date, subscription_status');

      if (profilesError) throw profilesError;

      // サブスクリプション統計を取得
      const { data: subscriptions, error: subsError } = await supabase
        .from('stripe_subscriptions')
        .select('status');

      if (subsError) {
        console.warn('Subscriptions table not found:', subsError);
      }

      // 統計を計算
      const now = new Date();
      const totalUsers = profiles?.length || 0;
      const guestUsers = profiles?.filter(p => p.role === 'guest').length || 0;
      const paidUsers = profiles?.filter(p => p.role === 'paid').length || 0;
      const adminUsers = profiles?.filter(p => p.role === 'admin').length || 0;
      const activeSubscriptions = subscriptions?.filter(s => s.status === 'active').length || 0;
      
      const expiredTrials = profiles?.filter(p => {
        if (p.role !== 'guest' || !p.trial_end_date) return false;
        return new Date(p.trial_end_date) < now;
      }).length || 0;

      // 売上計算（仮想：アクティブサブスクリプション数 × 500円）
      const revenue = activeSubscriptions * 500;

      setStats({
        totalUsers,
        guestUsers,
        paidUsers,
        adminUsers,
        activeSubscriptions,
        expiredTrials,
        revenue,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">統計を読み込み中...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">ダッシュボード</h2>
        <button
          onClick={loadStats}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          🔄 再読み込み
        </button>
      </div>

      {/* 主要統計 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-4xl">👥</span>
            <span className="text-3xl font-bold">{stats.totalUsers}</span>
          </div>
          <div className="text-blue-100 text-sm">総ユーザー数</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-4xl">💳</span>
            <span className="text-3xl font-bold">{stats.activeSubscriptions}</span>
          </div>
          <div className="text-green-100 text-sm">アクティブサブスク</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-4xl">💰</span>
            <span className="text-3xl font-bold">¥{stats.revenue.toLocaleString()}</span>
          </div>
          <div className="text-purple-100 text-sm">年間売上見込み</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-4xl">⏰</span>
            <span className="text-3xl font-bold">{stats.expiredTrials}</span>
          </div>
          <div className="text-orange-100 text-sm">トライアル期限切れ</div>
        </div>
      </div>

      {/* ユーザー内訳 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-lg font-bold mb-4">ユーザー内訳</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">{stats.adminUsers}</div>
            <div className="text-sm text-gray-600 mt-1">管理者</div>
            <div className="text-xs text-gray-500 mt-1">
              ({((stats.adminUsers / stats.totalUsers) * 100 || 0).toFixed(1)}%)
            </div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{stats.paidUsers}</div>
            <div className="text-sm text-gray-600 mt-1">有料会員</div>
            <div className="text-xs text-gray-500 mt-1">
              ({((stats.paidUsers / stats.totalUsers) * 100 || 0).toFixed(1)}%)
            </div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{stats.guestUsers}</div>
            <div className="text-sm text-gray-600 mt-1">ゲスト</div>
            <div className="text-xs text-gray-500 mt-1">
              ({((stats.guestUsers / stats.totalUsers) * 100 || 0).toFixed(1)}%)
            </div>
          </div>
        </div>
      </div>

      {/* クイックアクション */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold mb-4">クイックアクション</h3>
        <div className="grid grid-cols-2 gap-4">
          <button className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 text-left">
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold text-gray-800">詳細レポート</div>
            <div className="text-sm text-gray-600">詳細な統計レポートを表示</div>
          </button>
          <button className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 text-left">
            <div className="text-2xl mb-2">💳</div>
            <div className="font-semibold text-gray-800">Stripe管理</div>
            <div className="text-sm text-gray-600">決済設定を確認・変更</div>
          </button>
          <button className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 text-left">
            <div className="text-2xl mb-2">👥</div>
            <div className="font-semibold text-gray-800">ユーザー管理</div>
            <div className="text-sm text-gray-600">ユーザー一覧を表示</div>
          </button>
          <button className="p-4 border-2 border-orange-200 rounded-lg hover:bg-orange-50 text-left">
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-semibold text-gray-800">システム設定</div>
            <div className="text-sm text-gray-600">各種設定を変更</div>
          </button>
        </div>
      </div>
    </div>
  );
};
