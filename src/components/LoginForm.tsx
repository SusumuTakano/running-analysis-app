import React, { useState } from 'react';

type LoginFormProps = {
  onSubmit: (email: string, password: string) => void;
  onRegisterClick: () => void;
};

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, onRegisterClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'メールアドレスを入力してください';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }
    if (!password) {
      newErrors.password = 'パスワードを入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(email, password);
    }
  };

  return (
    <div style={{
      maxWidth: '400px',
      margin: '0 auto',
      padding: '24px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ marginBottom: '24px', fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center' }}>
        ログイン
      </h2>

      <form onSubmit={handleSubmit}>
        {/* メールアドレス */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            メールアドレス
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: errors.email ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            placeholder="example@example.com"
          />
          {errors.email && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.email}</span>}
        </div>

        {/* パスワード */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: errors.password ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            placeholder="パスワードを入力"
          />
          {errors.password && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.password}</span>}
        </div>

        {/* ログインボタン */}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '12px',
            border: 'none',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '16px'
          }}
        >
          ログイン
        </button>

        {/* 新規登録リンク */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#666', fontSize: '0.9rem' }}>
            アカウントをお持ちでない方は{' '}
          </span>
          <button
            type="button"
            onClick={onRegisterClick}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            新規登録
          </button>
        </div>
      </form>
    </div>
  );
};
