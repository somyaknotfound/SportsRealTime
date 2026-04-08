import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/matches': 'http://localhost:8000',
      '/subscriptions': 'http://localhost:8000',
      '/notifications': 'http://localhost:8000',
    },
  },
})
