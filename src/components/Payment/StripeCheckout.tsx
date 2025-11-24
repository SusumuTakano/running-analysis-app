import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';

interface StripeCheckoutProps {
  priceId?: string; // Stripeの年間サブスクリプションPrice ID
}

export const StripeCheckout: React.FC<StripeCheckoutProps> = ({ 
  priceId = 'price_XXXXXXXX' // 実際のStripe Price IDに置き換えてください
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (!user) {
      setError('ログインが必要です');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Edge Functionを呼び出してStripe Checkout Sessionを作成
      // 注: Supabase Edge Functionを別途作成する必要があります
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-checkout-session',
        {
          body: {
            priceId,
            userId: user.id,
            customerEmail: user.email,
          },
        }
      );

      if (functionError) throw functionError;

      // Stripe Checkoutページにリダイレクト
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Checkout URLの取得に失敗しました');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || '決済の開始に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold mb-4">有料プランにアップグレード</h3>
      
      <div className="mb-6">
        <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-bold">年間プラン</span>
            <span className="text-2xl font-bold text-blue-600">¥500/年</span>
          </div>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>✓ すべての機能を無制限に利用</li>
            <li>✓ ランニング動作解析</li>
            <li>✓ データ保存・履歴管理</li>
            <li>✓ 詳細なメトリクス表示</li>
            <li>✓ グラフ・レポート機能</li>
          </ul>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-blue-500 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '処理中...' : 'Stripeで決済する'}
      </button>

      <p className="mt-4 text-xs text-gray-500 text-center">
        Stripeの安全な決済画面に移動します
      </p>
    </div>
  );
};
