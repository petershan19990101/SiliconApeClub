import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const assetBasePath = env.VITE_ASSET_BASE_PATH?.trim() || '/';
  const base =
    command === 'build'
      ? assetBasePath.endsWith('/')
        ? assetBasePath
        : `${assetBasePath}/`
      : '/';

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
