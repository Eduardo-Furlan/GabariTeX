import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isDesktop = Boolean(process.env.TAURI_ENV_PLATFORM);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  clearScreen: false,
  define: {
    __DESKTOP__: JSON.stringify(isDesktop),
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === 'windows'
        ? 'chrome105'
        : isDesktop
          ? 'safari13'
          : 'es2020',
  },
});
