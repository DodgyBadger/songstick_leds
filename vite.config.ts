import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
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
  },
  preview: {
    host: '0.0.0.0',
    port: 43173,
    strictPort: true,
  },
});
