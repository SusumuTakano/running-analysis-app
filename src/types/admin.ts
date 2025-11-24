// 管理画面関連の型定義

export type SystemSettings = {
  id: string;
  stripe_api_key?: string;
  stripe_publishable_key?: string;
  stripe_webhook_secret?: string;
  stripe_yearly_price_id?: string;
  trial_period_days: number;
  subscription_price_jpy: number;
  app_name: string;
  support_email?: string;
  created_at: string;
  updated_at: string;
};

export type UserWithDetails = {
  id: string;
  email: string;
  full_name?: string;
  role: 'guest' | 'paid' | 'admin';
  trial_start_date?: string;
  trial_end_date?: string;
  subscription_status?: string;
  created_at: string;
  updated_at: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
};

export type AdminStats = {
  totalUsers: number;
  guestUsers: number;
  paidUsers: number;
  adminUsers: number;
  activeSubscriptions: number;
  expiredTrials: number;
  revenue: number;
};
