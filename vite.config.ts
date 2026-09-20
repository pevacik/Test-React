import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Проксируем API-запросы на бэкенд, чтобы в dev-режиме фронтенд
      // ходил на относительный /api/* без CORS-проблем.
      '/api': 'http://localhost:3001',
    },
  },
})
