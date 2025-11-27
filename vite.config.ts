
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0].replace(/-/g, '')),
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    headers: {
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'unsafe-none'
    }
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      external: ['capacitor.js']
    }
  }
});