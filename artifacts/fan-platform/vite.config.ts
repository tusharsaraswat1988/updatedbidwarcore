import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { getDevPorts } from '../../scripts/dev-ports.mjs';
import { getDevApiProxyTarget } from '../../lib/api-base/src/vite-proxy.ts';

const fanPort = getDevPorts().fanPlatform;

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  publicDir: path.resolve(__dirname, './public'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Default Vite localhost binds IPv6-only on this machine, so 127.0.0.1 never connects.
    host: '0.0.0.0',
    port: fanPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: getDevApiProxyTarget(),
        changeOrigin: true,
      },
    },
  },
});
