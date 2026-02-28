import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || 'https://stratify.associates'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      components: fileURLToPath(new URL('./src/components', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
