import React, { createContext, useContext, useState } from 'react';
import { AuthContextType, Profile } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 常にログインしていない状態として扱う
  const [user] = useState<Profile | null>(null);
  const [loading] = useState(false);

  // ダミーの関数
  const signIn = async (email: string, password: string) => {
    console.log('Sign in disabled temporarily');
    throw new Error('認証システムを修正中です。しばらくお待ちください。');
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    console.log('Sign up disabled temporarily');
    throw new Error('認証システムを修正中です。しばらくお待ちください。');
  };

  const signUpAsGuest = async (email: string, password: string, fullName?: string) => {
    console.log('Guest sign up disabled temporarily');
    throw new Error('認証システムを修正中です。しばらくお待ちください。');
  };

  const signOut = async () => {
    console.log('Sign out disabled temporarily');
  };

  const isSubscriptionActive = () => false;
  const isTrialExpired = () => false;
  const daysLeftInTrial = () => 0;

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