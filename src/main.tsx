import React from 'react'
import ReactDOM from 'react-dom/client'
// import AppWithRouter from './AppWithRouter.tsx'
import AppDirect from './AppDirect.tsx'
import './index.css'

// 一時的に認証をバイパスして直接アプリを表示
ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppDirect />
)
