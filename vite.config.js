import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = String(
    env.VITE_API_PROXY_TARGET
    || env.VITE_API_BASE
    || 'https://stratify.associates'
  ).replace(/\/$/, '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        components: fileURLToPath(new URL('./src/components', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: apiProxyTarget.startsWith('https://'),
        },
      },
    },
  };
})
