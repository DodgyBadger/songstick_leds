import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 43173,
    strictPort: true,
    allowedHosts: ['songstick.dodgybadger.icu'],
  },
  preview: {
    host: '0.0.0.0',
    port: 43173,
    strictPort: true,
    allowedHosts: ['songstick.dodgybadger.icu'],
  },
});
