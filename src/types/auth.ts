// 認証関連の型定義

export type UserRole = 'guest' | 'paid' | 'admin';

export type Profile = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: UserRole;
  trial_start_date?: string;
  trial_end_date?: string;
  subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | null;
  created_at: string;
  updated_at: string;
};

export type StripeCustomer = {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  created_at: string;
};

export type StripeSubscription = {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: string;
  price_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthContextType = {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signUpAsGuest: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  isSubscriptionActive: () => boolean;
  isTrialExpired: () => boolean;
  daysLeftInTrial: () => number;
};
