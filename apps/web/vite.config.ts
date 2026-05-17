import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  // The app is always served under /__unginx/ in production (nginx → backend
  // strips this prefix). Setting `base` makes Vite prefix all built asset
  // URLs (script/link tags in index.html) with /__unginx/ so the browser
  // requests them through the admin location instead of the catch-all 404.
  base: '/__unginx/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/__unginx/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__unginx/, ''),
      },
    },
  },
})
