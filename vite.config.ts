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
    hmr: false,
    allowedHosts: [
      '5173-iiu3g07ffhcmkyb0q957h-a402f90a.sandbox.novita.ai',
      '.sandbox.novita.ai'
    ]
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  }
})
