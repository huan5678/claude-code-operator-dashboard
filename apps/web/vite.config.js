import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, rootDir, '');
  const clientId =
    rootEnv.VITE_GOOGLE_CLIENT_ID ||
    rootEnv.GOOGLE_CLIENT_ID ||
    '';

  const backendPort = rootEnv.PORT || '3000';
  // 後端綁 127.0.0.1（IPv4）— proxy target 也用 127.0.0.1 避免 Node 18+ DNS 優先解析
  // 'localhost' 成 IPv6 ::1 導致 ECONNREFUSED → vite fallback 回 404
  const proxyTarget = `http://127.0.0.1:${backendPort}`;
  console.log(`[vite] API proxy /api/* → ${proxyTarget} (PORT from root .env: ${rootEnv.PORT ?? 'unset, using 3000'})`);

  return {
    plugins: [vue()],
    envDir: rootDir,
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(clientId),
    },
    server: {
      port: 5173,
      strictPort: true,
      allowedHosts: ['codd.shrhuan.ai'],
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          configure(proxy) {
            proxy.on('error', (err, req) => {
              console.error(
                `[vite-proxy] FAIL ${req.method} ${req.url} → ${proxyTarget} :`,
                `${err.code} ${err.message}`,
                '\n→ 後端可能沒跑 (npm start) 或 PORT 不一致；root .env PORT=' + (rootEnv.PORT ?? 'unset')
              );
            });
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
