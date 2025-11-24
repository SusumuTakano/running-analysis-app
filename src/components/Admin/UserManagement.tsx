import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { UserWithDetails } from '../../types/admin';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'guest' | 'paid' | 'admin'>('all');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          stripe_customers(stripe_customer_id),
          stripe_subscriptions(stripe_subscription_id, status)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // データを整形
      const usersWithDetails = data.map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        trial_start_date: user.trial_start_date,
        trial_end_date: user.trial_end_date,
        subscription_status: user.subscription_status,
        created_at: user.created_at,
        updated_at: user.updated_at,
        stripe_customer_id: user.stripe_customers?.[0]?.stripe_customer_id,
        stripe_subscription_id: user.stripe_subscriptions?.[0]?.stripe_subscription_id,
      }));

      setUsers(usersWithDetails);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'guest' | 'paid' | 'admin') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      // ローカル状態を更新
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      alert('ユーザー役割を更新しました');
    } catch (err: any) {
      console.error('Error updating user role:', err);
      alert('更新に失敗しました: ' + err.message);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('本当にこのユーザーを削除しますか？')) return;

    try {
      // Supabase Authからユーザーを削除（管理者権限が必要）
      // 注: この操作にはサービスロールキーが必要な場合があります
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) throw error;

      setUsers(users.filter(u => u.id !== userId));
      alert('ユーザーを削除しました');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      alert('削除に失敗しました: ' + err.message);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { bg: 'bg-purple-100', text: 'text-purple-800', label: '管理者' },
      paid: { bg: 'bg-green-100', text: 'text-green-800', label: '有料' },
      guest: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'ゲスト' },
    };
    const badge = badges[role as keyof typeof badges] || badges.guest;
    return (
      <span className={`${badge.bg} ${badge.text} px-2 py-1 rounded text-xs font-semibold`}>
        {badge.label}
      </span>
    );
  };

  const getStatusBadge = (user: UserWithDetails) => {
    if (user.role === 'admin') {
      return <span className="text-green-600 text-sm">✓ 有効</span>;
    }
    
    if (user.subscription_status === 'active') {
      return <span className="text-green-600 text-sm">✓ サブスク有効</span>;
    }

    if (user.trial_end_date) {
      const trialEnd = new Date(user.trial_end_date);
      const now = new Date();
      if (now < trialEnd) {
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return <span className="text-orange-600 text-sm">トライアル残り{daysLeft}日</span>;
      } else {
        return <span className="text-red-600 text-sm">期限切れ</span>;
      }
    }

    return <span className="text-gray-600 text-sm">-</span>;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">ユーザーを読み込み中...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">ユーザー管理</h2>
        <button
          onClick={loadUsers}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          🔄 再読み込み
        </button>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-gray-800">{users.length}</div>
          <div className="text-sm text-gray-600">総ユーザー数</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-800">
            {users.filter(u => u.role === 'admin').length}
          </div>
          <div className="text-sm text-gray-600">管理者</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-800">
            {users.filter(u => u.role === 'paid').length}
          </div>
          <div className="text-sm text-gray-600">有料会員</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-800">
            {users.filter(u => u.role === 'guest').length}
          </div>
          <div className="text-sm text-gray-600">ゲスト</div>
        </div>
      </div>

      {/* 検索とフィルター */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="メールアドレスまたは名前で検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">すべて</option>
          <option value="admin">管理者</option>
          <option value="paid">有料会員</option>
          <option value="guest">ゲスト</option>
        </select>
      </div>

      {/* ユーザーテーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ユーザー
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                役割
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ステータス
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                登録日
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {user.full_name || '名前なし'}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getRoleBadge(user.role)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(user)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value as any)}
                    className="mr-2 px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="guest">ゲスト</option>
                    <option value="paid">有料</option>
                    <option value="admin">管理者</option>
                  </select>
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            ユーザーが見つかりません
          </div>
        )}
      </div>
    </div>
  );
};
