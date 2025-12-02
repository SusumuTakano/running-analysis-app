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

  // 初期化
  useEffect(() => {
    console.log('🔐 [AuthContext] Starting initialization...');
    let mounted = true;

    const initAuth = async () => {
      try {
        // セッションを取得
        console.log('🔐 [AuthContext] Getting session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [AuthContext] Session error:', error);
        }

        if (!mounted) return;

        if (session?.user) {
          console.log('✅ [AuthContext] Session found for:', session.user.email);
          
          // シンプルなユーザーオブジェクトを設定（プロフィール取得をスキップ）
          const simpleUser: Profile = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || '',
            role: session.user.role || 'user',
            created_at: session.user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any;
          
          console.log('✅ [AuthContext] Setting user:', simpleUser);
          setUser(simpleUser);
          
        } else {
          console.log('❌ [AuthContext] No session found');
        }
        
      } catch (error) {
        console.error('❌ [AuthContext] Init error:', error);
      } finally {
        if (mounted) {
          console.log('✅ [AuthContext] Setting loading to false');
          setLoading(false);
        }
      }
    };

    // 遅延なしで即座に実行
    initAuth();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        console.log('🔄 [AuthContext] Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ [AuthContext] User signed in:', session.user.email);
          
          const simpleUser: Profile = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || '',
            role: session.user.role || 'user',
            created_at: session.user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any;
          
          setUser(simpleUser);
          setLoading(false);
          
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 [AuthContext] User signed out');
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      console.log('🧹 [AuthContext] Cleanup');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // 空の依存配列

  // サインイン
  const signIn = async (email: string, password: string) => {
    console.log('🔐 [AuthContext] Sign in attempt:', email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('❌ [AuthContext] Sign in error:', error);
        
        if (error.message.includes('Email not confirmed')) {
          throw new Error('メールアドレスが確認されていません。確認メールをチェックしてください。');
        } else if (error.message.includes('Invalid login credentials')) {
          throw new Error('メールアドレスまたはパスワードが間違っています。');
        } else {
          throw error;
        }
      }
      
      console.log('✅ [AuthContext] Sign in successful');
      
      // onAuthStateChangeがユーザー設定を処理するので、ここでは何もしない
      
    } catch (error) {
      console.error('❌ [AuthContext] Sign in exception:', error);
      throw error;
    }
  };

  // サインアップ
  const signUp = async (email: string, password: string, fullName?: string) => {
    console.log('📝 [AuthContext] Sign up attempt:', email);
    
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
      console.error('❌ [AuthContext] Sign up error:', error);
      throw error;
    }
    
    console.log('✅ [AuthContext] Sign up successful');
  };

  // ゲストサインアップ
  const signUpAsGuest = async (email: string, password: string, fullName?: string) => {
    console.log('🎁 [AuthContext] Guest sign up attempt:', email);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          is_guest: true,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error('❌ [AuthContext] Guest sign up error:', error);
      throw error;
    }
    
    console.log('✅ [AuthContext] Guest sign up successful');
  };

  // サインアウト
  const signOut = async () => {
    console.log('👋 [AuthContext] Sign out attempt');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ [AuthContext] Sign out error:', error);
      throw error;
    }
    setUser(null);
    console.log('✅ [AuthContext] Sign out successful');
  };

  // サブスクリプション確認
  const isSubscriptionActive = (): boolean => {
    if (!user) return false;
    // 簡略化：全ユーザーをアクティブとして扱う
    return true;
  };

  // トライアル期限確認
  const isTrialExpired = (): boolean => {
    // 簡略化：期限切れなし
    return false;
  };

  // トライアル残り日数
  const daysLeftInTrial = (): number => {
    // 簡略化：常に7日
    return 7;
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

  console.log('🔄 [AuthContext] Render - loading:', loading, 'user:', user?.email);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};