import React, { useState } from 'react';

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

type RegisterFormData = {
  name: string;
  nameKana: string;
  email: string;
  password: string;
  passwordConfirm: string;
  gender: 'male' | 'female' | 'other' | '';
  age: string;
  height: string;
  prefecture: string;
  organization: string;
};

type RegisterFormProps = {
  onSubmit: (data: RegisterFormData) => void;
  onCancel: () => void;
};

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    nameKana: '',
    email: '',
    password: '',
    passwordConfirm: '',
    gender: '',
    age: '',
    height: '',
    prefecture: '',
    organization: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof RegisterFormData, string>> = {};

    if (!formData.name.trim()) newErrors.name = '名前を入力してください';
    if (!formData.nameKana.trim()) newErrors.nameKana = '名前（かな）を入力してください';
    if (!/^[\u3040-\u309F\u30A0-\u30FF\s]+$/.test(formData.nameKana)) {
      newErrors.nameKana = 'ひらがな・カタカナで入力してください';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'メールアドレスを入力してください';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }
    if (!formData.password) {
      newErrors.password = 'パスワードを入力してください';
    } else if (formData.password.length < 8) {
      newErrors.password = 'パスワードは8文字以上で入力してください';
    }
    if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = 'パスワードが一致しません';
    }
    if (!formData.gender) newErrors.gender = '性別を選択してください';
    if (!formData.age) {
      newErrors.age = '年齢を入力してください';
    } else if (isNaN(Number(formData.age)) || Number(formData.age) < 0 || Number(formData.age) > 150) {
      newErrors.age = '有効な年齢を入力してください';
    }
    if (!formData.height) {
      newErrors.height = '身長を入力してください';
    } else if (isNaN(Number(formData.height)) || Number(formData.height) < 50 || Number(formData.height) > 250) {
      newErrors.height = '有効な身長を入力してください（50-250cm）';
    }
    if (!formData.prefecture) newErrors.prefecture = '都道府県を選択してください';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '24px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ marginBottom: '24px', fontSize: '1.5rem', fontWeight: 'bold' }}>
        デベロッパー版 新規登録
      </h2>
      <p style={{ marginBottom: '20px', color: '#666', fontSize: '0.9rem' }}>
        ※ 2025年12月末まで無料でご利用いただけます
      </p>

      <form onSubmit={handleSubmit}>
        {/* 名前 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            名前 <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: errors.name ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            placeholder="山田 太郎"
          />
          {errors.name && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.name}</span>}
        </div>

        {/* 名前（かな） */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            名前（かな） <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            value={formData.nameKana}
            onChange={(e) => handleChange('nameKana', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: errors.nameKana ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            placeholder="やまだ たろう"
          />
          {errors.nameKana && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.nameKana}</span>}
        </div>

        {/* メールアドレス */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            メールアドレス <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: errors.email ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            placeholder="example@example.com"
          />
          {errors.email && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.email}</span>}
        </div>

        {/* パスワード */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            パスワード <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: errors.password ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            placeholder="8文字以上"
          />
          {errors.password && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.password}</span>}
        </div>

        {/* パスワード確認 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            パスワード（確認） <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="password"
            value={formData.passwordConfirm}
            onChange={(e) => handleChange('passwordConfirm', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: errors.passwordConfirm ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            placeholder="パスワードを再入力"
          />
          {errors.passwordConfirm && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.passwordConfirm}</span>}
        </div>

        {/* 性別 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            性別 <span style={{ color: 'red' }}>*</span>
          </label>
          <select
            value={formData.gender}
            onChange={(e) => handleChange('gender', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: errors.gender ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
          >
            <option value="">選択してください</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">その他</option>
          </select>
          {errors.gender && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.gender}</span>}
        </div>

        {/* 年齢 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            年齢 <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="number"
            value={formData.age}
            onChange={(e) => handleChange('age', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: errors.age ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            placeholder="30"
            min="0"
            max="150"
          />
          {errors.age && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.age}</span>}
        </div>

        {/* 身長 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            身長（cm） <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="number"
            value={formData.height}
            onChange={(e) => handleChange('height', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: errors.height ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            placeholder="170"
            min="50"
            max="250"
            step="0.1"
          />
          {errors.height && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.height}</span>}
        </div>

        {/* 都道府県 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            都道府県 <span style={{ color: 'red' }}>*</span>
          </label>
          <select
            value={formData.prefecture}
            onChange={(e) => handleChange('prefecture', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: errors.prefecture ? '1px solid red' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
          >
            <option value="">選択してください</option>
            {PREFECTURES.map(pref => (
              <option key={pref} value={pref}>{pref}</option>
            ))}
          </select>
          {errors.prefecture && <span style={{ color: 'red', fontSize: '0.85rem' }}>{errors.prefecture}</span>}
        </div>

        {/* 所属 */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            所属（任意）
          </label>
          <input
            type="text"
            value={formData.organization}
            onChange={(e) => handleChange('organization', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            placeholder="〇〇ランニングクラブ"
          />
        </div>

        {/* ボタン */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              background: 'white',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            キャンセル
          </button>
          <button
            type="submit"
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            登録
          </button>
        </div>
      </form>
    </div>
  );
};
