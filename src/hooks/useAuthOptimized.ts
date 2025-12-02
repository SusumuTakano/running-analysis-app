import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile } from '../types/auth';
import { User } from '@supabase/supabase-js';

/**
 * 最適化された認証フック
 * - デバウンス処理
 * - キャッシュ管理
 * - 重複リクエスト防止
 */
export const useAuthOptimized = () => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // プロフィール取得のキャッシュ
  const profileCache = useRef<Map<string, { data: Profile; timestamp: number }>>(new Map());
  const CACHE_TTL = 5 * 60 * 1000; // 5分間キャッシュ
  
  // 実行中のリクエストを追跡
  const pendingRequests = useRef<Map<string, Promise<Profile | null>>>(new Map());

  /**
   * キャッシュからプロフィールを取得
   */
  const getCachedProfile = useCallback((userId: string): Profile | null => {
    const cached = profileCache.current.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('📦 Using cached profile for:', userId);
      return cached.data;
    }
    return null;
  }, []);

  /**
   * プロフィールをキャッシュに保存
   */
  const setCachedProfile = useCallback((userId: string, profile: Profile) => {
    profileCache.current.set(userId, {
      data: profile,
      timestamp: Date.now()
    });
    console.log('💾 Profile cached for:', userId);
  }, []);

  /**
   * プロフィール取得（重複リクエスト防止）
   */
  const fetchUserProfile = useCallback(async (authUser: User): Promise<Profile | null> => {
    try {
      // キャッシュチェック
      const cached = getCachedProfile(authUser.id);
      if (cached) {
        return cached;
      }

      // 実行中のリクエストがあれば待機
      const pending = pendingRequests.current.get(authUser.id);
      if (pending) {
        console.log('⏳ Waiting for pending profile request:', authUser.id);
        return await pending;
      }

      // 新しいリクエストを開始
      console.log('🔄 Fetching fresh profile for:', authUser.id);
      const request = (async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (error || !data) {
            // フォールバック
            const fallbackProfile: Profile = {
              id: authUser.id,
              email: authUser.email || '',
              full_name: authUser.user_metadata?.full_name || '',
              role: 'user',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as any;
            return fallbackProfile;
          }

          // キャッシュに保存
          setCachedProfile(authUser.id, data);
          return data;
        } finally {
          // リクエスト完了後、pendingから削除
          pendingRequests.current.delete(authUser.id);
        }
      })();

      // pendingリクエストとして登録
      pendingRequests.current.set(authUser.id, request);
      return await request;
    } catch (error) {
      console.error('❌ Failed to fetch profile:', error);
      return null;
    }
  }, [getCachedProfile, setCachedProfile]);

  /**
   * 初期化処理（最適化版）
   */
  useEffect(() => {
    let mounted = true;
    let initTimeout: NodeJS.Timeout;

    const initAuth = async () => {
      console.log('🔐 Optimized auth initialization started');
      
      try {
        // セッション取得（エラーハンドリング改善）
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.warn('⚠️ Session error (non-critical):', error.message);
        }

        if (session?.user) {
          const profile = await fetchUserProfile(session.user);
          if (mounted && profile) {
            setUser(profile);
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (mounted) {
          setError('認証の初期化に失敗しました');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // 初期化を少し遅延させて、レンダリングをブロックしない
    initTimeout = setTimeout(initAuth, 0);

    // 認証状態の変更を監視（最適化版）
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔄 Auth state changed:', event);
        
        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              const profile = await fetchUserProfile(session.user);
              if (mounted && profile) {
                setUser(profile);
                setLoading(false);
              }
            }
            break;
            
          case 'SIGNED_OUT':
            // キャッシュクリア
            profileCache.current.clear();
            pendingRequests.current.clear();
            if (mounted) {
              setUser(null);
              setLoading(false);
            }
            break;
            
          case 'TOKEN_REFRESHED':
            // トークンリフレッシュ時は、キャッシュを使用
            if (session?.user && !user) {
              const profile = await fetchUserProfile(session.user);
              if (mounted && profile) {
                setUser(profile);
              }
            }
            break;
            
          default:
            break;
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, []); // 空の依存配列で初回のみ実行

  return {
    user,
    loading,
    error,
    refetchProfile: useCallback(async () => {
      if (user) {
        // キャッシュをクリアして再取得
        profileCache.current.delete(user.id);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchUserProfile(session.user);
          if (profile) {
            setUser(profile);
          }
        }
      }
    }, [user, fetchUserProfile])
  };
};