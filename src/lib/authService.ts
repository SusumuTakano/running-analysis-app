import { supabase } from './supabaseClient';

export type UserProfile = {
  id: string;
  name: string;
  name_kana: string;
  gender: 'male' | 'female' | 'other';
  birthdate: string;
  age: number;
  height_cm: number;
  prefecture: string;
  organization?: string;
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
  const age = calculateAge(data.birthdate);
  
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: authData.user.id,
      name: data.name,
      name_kana: data.nameKana,
      gender: data.gender as 'male' | 'female' | 'other',
      birthdate: data.birthdate,
      age: age,
      height_cm: parseFloat(data.height),
      prefecture: data.prefecture,
      organization: data.organization || null,
    });

  if (profileError) {
    console.error('Profile insert error:', profileError);
    // プロフィール登録失敗時は認証ユーザーも削除
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error('プロフィール登録に失敗しました');
  }

  return authData.user;
}

/**
 * ログイン
 */
export async function loginUser(email: string, password: string) {
  console.log('Attempting login with Supabase...');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

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
    } else {
      errorMessage = 'ログインに失敗しました: ' + error.message;
    }
    
    throw new Error(errorMessage);
  }

  console.log('Login successful, user ID:', data.user?.id);
  return data;
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
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Get profile error:', error);
    return null;
  }

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
