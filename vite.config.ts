import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    minify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          mediapipe: ['@mediapipe/tasks-vision'],
          charts: ['chart.js', 'react-chartjs-2']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: false
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  }
})
