import { supabase } from './supabaseClient';

export type UserProfile = {
  id: string;
  name: string;
  name_kana: string;
  gender: 'male' | 'female' | 'other';
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
  age: string;
  height: string;
  prefecture: string;
  organization?: string;
};

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
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: authData.user.id,
      name: data.name,
      name_kana: data.nameKana,
      gender: data.gender as 'male' | 'female' | 'other',
      age: parseInt(data.age),
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Login error:', error);
    throw new Error('ログインに失敗しました: ' + error.message);
  }

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
 */
export async function isDeveloperPeriodValid(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_developer_period_valid');

  if (error) {
    console.error('Check developer period error:', error);
    return false;
  }

  return data === true;
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
