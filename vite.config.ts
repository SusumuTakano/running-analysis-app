import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    minify: false, // エラーメッセージを詳細に表示
    sourcemap: true // ソースマップを有効化
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: false,
    allowedHosts: [
      '3000-iutfhg38ul7w1p11026dx-cc2fbc16.sandbox.novita.ai',
      '.sandbox.novita.ai'
    ]
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      '3000-iutfhg38ul7w1p11026dx-cc2fbc16.sandbox.novita.ai',
      '.sandbox.novita.ai'
    ]
  }
})
