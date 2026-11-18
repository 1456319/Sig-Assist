/// <reference types="vitest" />
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { getBuildIdentity } from './scripts/build-identity.mjs';

// Shared with package verification; includes desktop/connector code as well as UI.
const { version, buildId } = getBuildIdentity();

export default defineConfig({
  define: { __SIG_ASSIST_VERSION__: JSON.stringify(version), __SIG_ASSIST_BUILD__: JSON.stringify(buildId) },
  plugins: [react(), {
    name: 'startup-build-fingerprint',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'sig-assist-version', content: version }, injectTo: 'head-prepend' }, { tag: 'meta', attrs: { name: 'sig-assist-build', content: buildId }, injectTo: 'head-prepend' }],
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
