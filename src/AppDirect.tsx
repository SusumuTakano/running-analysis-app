import React from 'react';
import App from './App';

// 認証を完全にバイパスして直接アプリを表示
const AppDirect: React.FC = () => {
  console.log('🚀 AppDirect: Bypassing auth, showing app directly');
  
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md mb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-800">
                ランニング動作解析システム
              </h1>
              <span className="ml-3 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                認証なしモード
              </span>
            </div>
          </div>
        </div>
      </nav>
      
      <App />
    </div>
  );
};

export default AppDirect;