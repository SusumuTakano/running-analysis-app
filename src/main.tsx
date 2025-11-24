import React from 'react'
import ReactDOM from 'react-dom/client'
import AppWithAuth from './AppWithAuth.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithAuth />
  </React.StrictMode>,
)
