import { defineConfig } from 'vite';
import { midiUploadPlugin } from './dev/midi-upload-plugin.ts';

export default defineConfig({
  root: 'web',
  publicDir: 'public',
  plugins: [midiUploadPlugin()],
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
