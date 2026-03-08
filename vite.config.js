import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const defaultApiTarget =
    mode === 'development'
      ? 'http://localhost:3000'  // vercel dev; run "vercel dev" then "npm run dev"
      : 'https://stratify.associates';
  const apiProxyTarget = String(
    env.VITE_API_PROXY_TARGET
    || env.VITE_API_BASE
    || defaultApiTarget
  ).replace(/\/$/, '');

  return {
    plugins: [react()],
    optimizeDeps: {
      include: [
        'lightweight-charts-line-tools-core',
        'lightweight-charts-line-tools-lines',
        'lightweight-charts-line-tools-rectangle',
        'lightweight-charts-line-tools-fib-retracement',
        'lightweight-charts-line-tools-parallel-channel',
      ],
    },
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
