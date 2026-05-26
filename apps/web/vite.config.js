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

  return {
    plugins: [vue()],
    envDir: rootDir,
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(clientId),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${rootEnv.PORT || 3000}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
