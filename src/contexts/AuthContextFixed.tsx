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

  // ユーザープロフィールを取得（シンプル版）
  const fetchUserProfile = async (authUser: User): Promise<void> => {
    try {
      console.log('📋 Fetching profile for user:', authUser.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (data) {
        console.log('✅ Profile found:', data);
        setUser(data);
      } else {
        // プロフィールが存在しない場合、デフォルトプロフィールを作成
        console.log('📝 Creating default profile...');
        const defaultProfile = {
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name || '',
          role: 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: newProfile } = await supabase
          .from('profiles')
          .insert(defaultProfile)
          .select()
          .maybeSingle();

        if (newProfile) {
          setUser(newProfile);
        } else {
          // フォールバック
          setUser(defaultProfile as any);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      // エラーでもフォールバック
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name || '',
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any);
    }
  };

  // 初期化：認証状態の確認（シンプル版）
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        console.log('🔐 Initializing auth...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            console.log('✅ Session found');
            await fetchUserProfile(session.user);
          } else {
            console.log('❌ No session');
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Auth init error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // 初期化実行
    initAuth();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔄 Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUserProfile(session.user);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // トークンリフレッシュ時は何もしない（すでにユーザー情報がある場合）
          if (!user) {
            await fetchUserProfile(session.user);
          }
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // 空の依存配列（初回のみ実行）

  // サインイン
  const signIn = async (email: string, password: string) => {
    console.log('🔐 Signing in:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('❌ Sign in error:', error);
      
      // エラーメッセージを日本語化
      if (error.message.includes('Email not confirmed')) {
        throw new Error('メールアドレスが確認されていません。確認メールをチェックしてください。');
      } else if (error.message.includes('Invalid login credentials')) {
        throw new Error('メールアドレスまたはパスワードが間違っています。');
      } else {
        throw error;
      }
    }
    
    console.log('✅ Sign in successful');
    
    // プロフィール取得はonAuthStateChangeで行われる
    if (data.user) {
      await fetchUserProfile(data.user);
    }
  };

  // 通常のサインアップ
  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) throw error;

    // プロフィール作成
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
        role: 'paid',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select();
    }
  };

  // ゲストとしてサインアップ
  const signUpAsGuest = async (email: string, password: string, fullName?: string) => {
    console.log('🎁 Guest signup:', email);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) throw error;

    // ゲストプロフィール作成
    if (data.user) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
        role: 'guest',
        trial_start_date: now.toISOString(),
        trial_end_date: trialEnd.toISOString(),
        subscription_status: 'trialing',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }).select();
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
    
    if (user.is_admin || user.role === 'admin') {
      return true;
    }
    
    if (user.role === 'paid' && user.subscription_status === 'active') {
      return true;
    }
    
    return false;
  };

  // トライアル期間が終了しているかチェック
  const isTrialExpired = (): boolean => {
    if (!user || user.role !== 'guest') {
      return false;
    }
    
    if (!user.trial_end_date) {
      return true;
    }
    
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