import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API_TARGET erlaubt ein zweites Backend parallel (z. B. Port 4001)
      '/api': process.env.API_TARGET || 'http://localhost:4000',
    },
  },
})
