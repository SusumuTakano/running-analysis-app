import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthContextType, Profile } from '../types/auth';
import { User } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // ユーザープロフィールを取得
  const fetchUserProfile = async (authUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
    }
  };

  // 初期化：認証状態の確認
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          await fetchUserProfile(session.user);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // サインイン
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  // 通常のサインアップ（有料会員想定）
  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;

    // プロフィール作成（トリガーで自動作成される場合もあるが、念のため）
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
        role: 'paid', // デフォルトは有料会員想定
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }
    }
  };

  // ゲストとしてサインアップ（1週間トライアル）
  const signUpAsGuest = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;

    // ゲストプロフィール作成（1週間のトライアル期間）
    if (data.user) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7日後

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
        role: 'guest',
        trial_start_date: now.toISOString(),
        trial_end_date: trialEnd.toISOString(),
        subscription_status: 'trialing',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      if (profileError) {
        console.error('Error creating guest profile:', profileError);
      }
    }
  };

  // サインアウト
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  };

  // サブスクリプションがアクティブかチェック
  const isSubscriptionActive = (): boolean => {
    if (!user) return false;
    
    // 管理者は常にアクティブ（is_adminまたはrole='admin'）
    if (user.is_admin || user.role === 'admin') {
      return true;
    }
    
    // 有料会員でサブスクリプションがアクティブ
    if (user.role === 'paid' && user.subscription_status === 'active') {
      return true;
    }
    
    return false;
  };

  // トライアル期間が終了しているかチェック
  const isTrialExpired = (): boolean => {
    if (!user || user.role !== 'guest') return false;
    
    if (!user.trial_end_date) return true;
    
    const trialEnd = new Date(user.trial_end_date);
    const now = new Date();
    
    return now > trialEnd;
  };

  // トライアル残り日数
  const daysLeftInTrial = (): number => {
    if (!user || user.role !== 'guest' || !user.trial_end_date) return 0;
    
    const trialEnd = new Date(user.trial_end_date);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signUpAsGuest,
    signOut,
    isSubscriptionActive,
    isTrialExpired,
    daysLeftInTrial,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
