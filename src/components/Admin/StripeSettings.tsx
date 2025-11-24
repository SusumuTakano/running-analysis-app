import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { SystemSettings } from '../../types/admin';

export const StripeSettings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [settings, setSettings] = useState<SystemSettings>({
    id: '',
    stripe_api_key: '',
    stripe_publishable_key: '',
    stripe_webhook_secret: '',
    stripe_yearly_price_id: '',
    trial_period_days: 7,
    subscription_price_jpy: 500,
    app_name: 'ランニング動作解析システム',
    support_email: '',
    created_at: '',
    updated_at: '',
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // 設定を読み込む
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // system_settingsテーブルから設定を取得
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .single();

      if (error) {
        // テーブルが存在しない場合やデータがない場合はデフォルト値を使用
        console.log('Settings not found, using defaults');
      } else if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const now = new Date().toISOString();
      const settingsData = {
        ...settings,
        updated_at: now,
      };

      // 既存のレコードを更新、または新規作成
      if (settings.id) {
        const { error } = await supabase
          .from('system_settings')
          .update(settingsData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        settingsData.created_at = now;
        const { data, error } = await supabase
          .from('system_settings')
          .insert([settingsData])
          .select()
          .single();

        if (error) throw error;
        if (data) setSettings(data);
      }

      setMessage({ type: 'success', text: '設定を保存しました' });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: err.message || '設定の保存に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  const testStripeConnection = async () => {
    setMessage(null);
    try {
      // Stripe APIキーのバリデーション（簡易チェック）
      if (!settings.stripe_api_key) {
        setMessage({ type: 'error', text: 'Stripe APIキーを入力してください' });
        return;
      }

      if (!settings.stripe_api_key.startsWith('sk_')) {
        setMessage({ type: 'error', text: 'Stripe APIキーの形式が正しくありません（sk_で始まる必要があります）' });
        return;
      }

      setMessage({ type: 'success', text: 'Stripe APIキーの形式は正しいです（実際の接続テストはサーバー側で行われます）' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">設定を読み込み中...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Stripe設定</h2>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 border border-green-400 text-green-700'
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Stripe公開可能キー */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Stripe公開可能キー (Publishable Key)
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={settings.stripe_publishable_key || ''}
            onChange={(e) =>
              setSettings({ ...settings, stripe_publishable_key: e.target.value })
            }
            placeholder="pk_live_... または pk_test_..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            フロントエンドで使用される公開可能なキーです
          </p>
        </div>

        {/* Stripe APIキー（シークレットキー） */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Stripe APIキー (Secret Key)
            <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={settings.stripe_api_key || ''}
              onChange={(e) =>
                setSettings({ ...settings, stripe_api_key: e.target.value })
              }
              placeholder="sk_live_... または sk_test_..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-2 text-gray-500 hover:text-gray-700"
            >
              {showApiKey ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            サーバー側で使用される秘密キーです。絶対に公開しないでください
          </p>
          <button
            type="button"
            onClick={testStripeConnection}
            className="mt-2 text-sm text-blue-500 hover:text-blue-600"
          >
            接続テスト
          </button>
        </div>

        {/* Webhook Secret */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Webhook Secret
          </label>
          <div className="relative">
            <input
              type={showWebhookSecret ? 'text' : 'password'}
              value={settings.stripe_webhook_secret || ''}
              onChange={(e) =>
                setSettings({ ...settings, stripe_webhook_secret: e.target.value })
              }
              placeholder="whsec_..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              className="absolute right-3 top-2 text-gray-500 hover:text-gray-700"
            >
              {showWebhookSecret ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Stripe Webhookの署名検証に使用されます
          </p>
        </div>

        {/* 年間サブスクリプションPrice ID */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            年間サブスクリプション Price ID
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={settings.stripe_yearly_price_id || ''}
            onChange={(e) =>
              setSettings({ ...settings, stripe_yearly_price_id: e.target.value })
            }
            placeholder="price_..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Stripeダッシュボードで作成した年間サブスクリプション商品のPrice ID
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* トライアル期間 */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              トライアル期間（日数）
            </label>
            <input
              type="number"
              value={settings.trial_period_days}
              onChange={(e) =>
                setSettings({ ...settings, trial_period_days: parseInt(e.target.value) })
              }
              min="1"
              max="30"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* サブスクリプション価格 */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              年間料金（円）
            </label>
            <input
              type="number"
              value={settings.subscription_price_jpy}
              onChange={(e) =>
                setSettings({ ...settings, subscription_price_jpy: parseInt(e.target.value) })
              }
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={loadSettings}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            リセット
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </form>

      {/* 設定ガイド */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-bold text-blue-800 mb-2">📘 Stripe設定ガイド</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Stripeダッシュボード（https://dashboard.stripe.com）にログイン</li>
          <li>左メニューの「開発者」→「APIキー」から公開可能キーとシークレットキーを取得</li>
          <li>「商品」→「新規作成」で年間サブスクリプション商品を作成（500円/年）</li>
          <li>作成した商品のPrice IDをコピー</li>
          <li>「Webhook」を設定してWebhook Secretを取得</li>
          <li>上記の情報を各フィールドに入力して保存</li>
        </ol>
      </div>
    </div>
  );
};
