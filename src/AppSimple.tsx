import React from 'react';

type UserProfile = {
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

type AppProps = {
  userProfile: UserProfile | null;
};

const AppSimple: React.FC<AppProps> = () => {
  // userProfile を一切使わない
  console.log('AppSimple rendering - no props used');

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>✅ ログイン成功！</h1>
      <p>この画面が表示されたら、ログイン機能は正常に動作しています。</p>
      <p>元のアプリ画面を復元するには、管理者に連絡してください。</p>
    </div>
  );
};

export default AppSimple;
