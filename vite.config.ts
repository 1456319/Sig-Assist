/// <reference types="vitest" />
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

// A deterministic source fingerprint also identifies builds made outside Git.
const buildHash = createHash('sha256');
function hashSources(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) hashSources(filename);
    else {
      buildHash.update(path.relative(__dirname, filename).replaceAll('\\', '/'));
      buildHash.update('\0');
      buildHash.update(readFileSync(filename, 'utf8').replace(/\r\n/g, '\n'));
      buildHash.update('\0');
    }
  }
}
hashSources(path.join(__dirname, 'src'));
buildHash.update(readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n'));
buildHash.update(readFileSync(path.join(__dirname, 'package-lock.json'), 'utf8').replace(/\r\n/g, '\n'));
const buildId = buildHash.digest('hex');

export default defineConfig({
  define: { __SIG_ASSIST_BUILD__: JSON.stringify(buildId) },
  plugins: [react(), {
    name: 'startup-build-fingerprint',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'sig-assist-build', content: buildId }, injectTo: 'head-prepend' }],
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
  },
});
