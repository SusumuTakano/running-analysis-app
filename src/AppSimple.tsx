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

const AppSimple: React.FC<AppProps> = ({ userProfile }) => {
  console.log('AppSimple rendering with userProfile:', userProfile);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      color: 'white'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '40px',
        backdropFilter: 'blur(10px)'
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          🏃‍♂️ Running Analysis Studio
        </h1>

        <div style={{
          background: 'rgba(255, 255, 255, 0.2)',
          padding: '30px',
          borderRadius: '12px',
          marginTop: '30px'
        }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>
            ✅ ログイン成功！
          </h2>

          {userProfile ? (
            <div>
              <p style={{ fontSize: '1.2rem', marginBottom: '15px' }}>
                <strong>ユーザー情報:</strong>
              </p>
              <ul style={{ fontSize: '1.1rem', lineHeight: '1.8' }}>
                <li><strong>ID:</strong> {userProfile.id}</li>
                <li><strong>名前:</strong> {userProfile.name}</li>
                {userProfile.gender && <li><strong>性別:</strong> {userProfile.gender}</li>}
                {userProfile.age && <li><strong>年齢:</strong> {userProfile.age}歳</li>}
                {userProfile.height_cm && <li><strong>身長:</strong> {userProfile.height_cm}cm</li>}
                {userProfile.prefecture && <li><strong>都道府県:</strong> {userProfile.prefecture}</li>}
              </ul>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '1.2rem', color: '#ffd700' }}>
                ⚠️ プロフィール情報がありません
              </p>
              <p style={{ fontSize: '1rem', marginTop: '10px' }}>
                ログインは成功しましたが、プロフィールが読み込まれませんでした。
              </p>
            </div>
          )}

          <div style={{
            marginTop: '40px',
            padding: '20px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px'
          }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '15px' }}>
              📋 次のステップ
            </h3>
            <p style={{ fontSize: '1rem', lineHeight: '1.6' }}>
              この画面が正常に表示されたら、ログインと画面遷移は成功しています！
            </p>
            <p style={{ fontSize: '1rem', lineHeight: '1.6', marginTop: '10px' }}>
              元のアプリ画面（動画解析機能）を有効化するには、管理者に連絡してください。
            </p>
          </div>
        </div>

        <div style={{
          marginTop: '30px',
          textAlign: 'center',
          fontSize: '0.9rem',
          opacity: 0.8
        }}>
          <p>デベロッパー版 - 2025年12月末まで無料</p>
        </div>
      </div>
    </div>
  );
};

export default AppSimple;
