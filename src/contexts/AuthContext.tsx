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
      console.log('📋 Fetching profile for user:', authUser.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ Profile fetched successfully:', data);
      setUser(data);
    } catch (error) {
      console.error('❌ Failed to fetch user profile:', error);
      
      // プロフィールが存在しない場合は、基本的なユーザー情報だけで設定
      console.log('⚠️ Using fallback user data from auth');
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name || '',
        role: 'guest',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any);
    }
  };

  // 初期化：認証状態の確認
  useEffect(() => {
    const initAuth = async () => {
      console.log('🔐 AuthContext: Initializing authentication...');
      
      try {
        console.log('🔐 AuthContext: Calling supabase.auth.getSession()...');
        
        // タイムアウトを削除し、通常のPromiseとして実行
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ AuthContext: Error getting session:', error);
          return;
        }
        
        console.log('🔐 AuthContext: Session retrieved:', session ? 'User logged in' : 'No session');
        
        if (session?.user) {
          console.log('🔐 AuthContext: Fetching user profile...');
          await fetchUserProfile(session.user);
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
      } finally {
        // 必ずloadingをfalseにする
        console.log('✅ AuthContext: Loading complete, setting loading=false');
        setLoading(false);
      }
    };

    initAuth();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state change detected:', event, session?.user?.email);
        
        try {
          if (event === 'SIGNED_IN' && session?.user) {
            console.log('✅ User signed in, fetching profile...');
            await fetchUserProfile(session.user);
          } else if (event === 'SIGNED_OUT') {
            console.log('👋 User signed out');
            setUser(null);
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            console.log('🔄 Token refreshed');
            await fetchUserProfile(session.user);
          }
        } catch (error) {
          console.error('❌ Error in auth state change handler:', error);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // サインイン
  const signIn = async (email: string, password: string) => {
    console.log('🔐 Attempting sign in for:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('❌ Sign in error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        name: error.name,
      });
      
      // よりユーザーフレンドリーなエラーメッセージ
      if (error.message.includes('Email not confirmed')) {
        throw new Error('メールアドレスが確認されていません。確認メールをチェックしてください。');
      } else if (error.message.includes('Invalid login credentials')) {
        throw new Error('メールアドレスまたはパスワードが間違っています。');
      } else {
        throw error;
      }
    }
    
    console.log('✅ Sign in successful:', data.user?.email);
    
    // プロフィールを取得
    if (data.user) {
      await fetchUserProfile(data.user);
    }
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
        emailRedirectTo: window.location.origin,
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
        subscription_status: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }

      // ユーザー情報を即座に取得
      if (data.session) {
        await fetchUserProfile(data.user);
      }
    }
  };

  // ゲストとしてサインアップ（1週間トライアル）
  const signUpAsGuest = async (email: string, password: string, fullName?: string) => {
    console.log('🎁 Starting guest signup for:', email);
    
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

    if (error) {
      console.error('❌ Signup error:', error);
      throw error;
    }

    console.log('✅ Auth signup successful:', data);

    // ゲストプロフィール作成（1週間のトライアル期間）
    if (data.user) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7日後

      console.log('📝 Creating guest profile with trial:', {
        trialStart: now.toISOString(),
        trialEnd: trialEnd.toISOString()
      });

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
        console.error('❌ Error creating guest profile:', profileError);
        throw profileError;
      }

      console.log('✅ Guest profile created successfully');

      // セッションがある場合は即座にユーザー情報を取得
      if (data.session) {
        console.log('✅ Session exists, fetching user profile');
        await fetchUserProfile(data.user);
      } else {
        console.log('⚠️ No session - email confirmation required');
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
