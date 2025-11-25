import { supabase } from './supabaseClient';

export type UserProfile = {
  id: string;
  name: string;
  name_kana?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  birthdate?: string | null;
  age?: number | null;
  height_cm?: number | null;
  prefecture?: string | null;
  organization?: string | null;
  created_at: string;
  updated_at: string;
};

export type RegisterData = {
  name: string;
  nameKana: string;
  email: string;
  password: string;
  passwordConfirm: string;
  gender: 'male' | 'female' | 'other' | '';
  birthdate: string;
  height: string;
  prefecture: string;
  organization?: string;
};

/**
 * 生年月日から年齢を計算
 */
function calculateAge(birthdate: string): number {
  const birthDate = new Date(birthdate);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  return monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
    ? age - 1 
    : age;
}

/**
 * ユーザー登録
 */
export async function registerUser(data: RegisterData) {
  // バリデーション
  if (!data.gender) {
    throw new Error('性別を選択してください');
  }

  // 1. auth.usersに登録
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  });

  if (authError) {
    console.error('Auth signup error:', authError);
    throw new Error(authError.message);
  }

  if (!authData.user) {
    throw new Error('ユーザー登録に失敗しました');
  }

  // 2. user_profilesに詳細情報を登録
  const age = data.birthdate ? calculateAge(data.birthdate) : null;
  
  console.log('Creating user profile:', {
    userId: authData.user.id,
    name: data.name,
    email: data.email
  });
  
  const profileData: any = {
    id: authData.user.id,
    name: data.name || data.email, // 名前がない場合はメールアドレスを使用
  };
  
  // オプション項目は値がある場合のみ追加
  if (data.nameKana) profileData.name_kana = data.nameKana;
  if (data.gender) profileData.gender = data.gender;
  if (data.birthdate) {
    profileData.birthdate = data.birthdate;
    profileData.age = age;
  }
  if (data.height) profileData.height_cm = parseFloat(data.height);
  if (data.prefecture) profileData.prefecture = data.prefecture;
  if (data.organization) profileData.organization = data.organization;
  
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert(profileData);

  if (profileError) {
    console.error('Profile insert error:', {
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
      code: profileError.code
    });
    
    // 注意: admin.deleteUser は管理者権限が必要なため、失敗する可能性がある
    console.warn('Attempting to delete user due to profile creation failure...');
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Failed to sign out after profile error:', e);
    }
    
    throw new Error('プロフィール登録に失敗しました: ' + profileError.message);
  }
  
  console.log('✅ User profile created successfully');

  return authData.user;
}

/**
 * ログイン
 */
export async function loginUser(email: string, password: string) {
  console.log('Attempting login with Supabase...');
  console.log('Email:', email);
  console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('Start time:', new Date().toISOString());
  
  // 環境変数チェック
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Supabase環境変数が設定されていません。管理者に連絡してください。');
  }
  
  // より確実なタイムアウト実装（15秒）
  const TIMEOUT_MS = 15000;
  let timeoutId: number;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      console.log('Login timeout triggered at:', new Date().toISOString());
      reject(new Error('TIMEOUT'));
    }, TIMEOUT_MS);
  });
  
  const loginPromise = supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  try {
    const result = await Promise.race([
      loginPromise,
      timeoutPromise
    ]);
    
    clearTimeout(timeoutId!);
    console.log('Login completed at:', new Date().toISOString());
    
    const { data, error } = result as any;
    
    if (error) {
      console.error('Login error details:', {
        message: error.message,
        status: error.status,
        name: error.name
      });
      
      // より詳細なエラーメッセージ
      let errorMessage = 'ログインに失敗しました';
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'メールアドレスまたはパスワードが間違っています';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'メールアドレスが確認されていません。確認メールをご確認ください';
      } else if (error.message.includes('User not found')) {
        errorMessage = 'このメールアドレスは登録されていません';
      } else if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
        errorMessage = 'ネットワークエラー: インターネット接続を確認してください（Wi-Fi/モバイルデータ）';
      } else if (error.message.includes('timeout') || error.message.includes('abort')) {
        errorMessage = '接続がタイムアウトしました。電波の良い場所で再度お試しください。';
      } else {
        errorMessage = 'ログインに失敗しました: ' + error.message;
      }
      
      throw new Error(errorMessage);
    }

    console.log('Login successful, user ID:', data.user?.id);
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId!);
    console.error('Login exception at:', new Date().toISOString(), err);
    
    // タイムアウトエラーの場合
    if (err.message === 'TIMEOUT') {
      throw new Error('ログインがタイムアウトしました（15秒）。電波の良い場所で再度お試しください。');
    }
    
    throw err;
  }
}

/**
 * ログアウト
 */
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Logout error:', error);
    throw new Error('ログアウトに失敗しました');
  }
}

/**
 * 現在のユーザーのプロフィールを取得
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  console.log('Getting profile for user:', userId);
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Get profile error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    
    // RLSポリシーエラーの場合
    if (error.code === 'PGRST116' || error.message.includes('row-level security')) {
      console.error('❌ RLS policy is blocking access to user_profiles table');
      console.error('Please run supabase_rls_minimal.sql to disable RLS temporarily');
    }
    
    return null;
  }

  if (!data) {
    console.warn('⚠️ Profile data is null for user:', userId);
    return null;
  }

  console.log('✅ Profile loaded successfully:', data.name);
  return data;
}

/**
 * プロフィール更新
 */
export async function updateUserProfile(userId: string, updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>) {
  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('Update profile error:', error);
    throw new Error('プロフィール更新に失敗しました');
  }
}

/**
 * デベロッパー期間が有効かチェック
 * 2025年12月31日まで有効
 */
export async function isDeveloperPeriodValid(): Promise<boolean> {
  try {
    // まずSupabase RPCを試す
    const { data, error } = await supabase.rpc('is_developer_period_valid');
    
    if (!error && data !== null) {
      return data === true;
    }
    
    // RPCが失敗した場合はフロントエンドで判定
    console.warn('Using client-side date check for developer period');
  } catch (err) {
    console.error('RPC error, falling back to client-side check:', err);
  }
  
  // フォールバック: クライアント側で日付チェック
  const today = new Date();
  const endDate = new Date('2025-12-31');
  return today <= endDate;
}

/**
 * 身長からストライド比を計算
 * @param height - 身長（cm）
 * @param stride - ストライド（m）
 * @returns ストライド比（%）
 */
export function calculateStrideRatio(height: number, stride: number): number {
  // ストライド比 = (ストライド / 身長) × 100
  // 身長をmに変換
  const heightInMeters = height / 100;
  return (stride / heightInMeters) * 100;
}

/**
 * 理想的なストライド比の評価
 * @param strideRatio - ストライド比（%）
 * @returns 評価（excellent, good, fair, poor）
 */
export function evaluateStrideRatio(strideRatio: number): 'excellent' | 'good' | 'fair' | 'poor' {
  // 一般的にストライド比は75-85%が理想とされる
  if (strideRatio >= 80 && strideRatio <= 85) {
    return 'excellent';
  } else if (strideRatio >= 75 && strideRatio < 80) {
    return 'good';
  } else if (strideRatio >= 70 && strideRatio < 75) {
    return 'fair';
  } else {
    return 'poor';
  }
}
