import path from "path"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { InlineConfig } from 'vitest';
import type { UserConfig } from 'vite';

import tsconfigPaths from 'vite-tsconfig-paths';

interface VitestConfigExport extends UserConfig {
  test: InlineConfig;
}

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Sentinel GRC',
        short_name: 'Sentinel',
        description: 'Plateforme de Gouvernance, Risque et Conformité',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192.webp',
            sizes: '192x192',
            type: 'image/webp'
          },
          {
            src: '/icons/icon-512.webp',
            sizes: '512x512',
            type: 'image/webp'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(process.cwd(), 'src') }
    ],
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0].replace(/-/g, '')),
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    headers: {
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    },
    proxy: {
      '/api': {
        target: 'https://us-central1-sentinel-grc-a8701.cloudfunctions.net',
        changeOrigin: true,
        secure: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      external: ['capacitor.js'],
      output: {
        banner: "(() => {\n" +
          "  try {\n" +
          "    const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : undefined));\n" +
          "    if (!g) return;\n" +
          "    if (!g.setImmediate) {\n" +
          "      g.setImmediate = (cb, ...args) => {\n" +
          "        if (typeof cb !== 'function') throw new TypeError('setImmediate callback must be a function');\n" +
          "        return setTimeout(cb, 0, ...args);\n" +
          "      };\n" +
          "    }\n" +
          "    if (!g.clearImmediate) {\n" +
          "      g.clearImmediate = (id) => clearTimeout(id);\n" +
          "    }\n" +
          "  } catch (_) {\n" +
          "    // no-op\n" +
          "  }\n" +
          "})();",
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app'],
          firebase_auth: ['firebase/auth'],
          firebase_firestore: ['firebase/firestore'],
          firebase_storage: ['firebase/storage'],
          firebase_functions: ['firebase/functions'],
          firebase_analytics: ['firebase/analytics'],
          ui: ['clsx', 'tailwind-merge'],
          charts: ['recharts'],
          utils: ['date-fns', 'zod'],
          pdf: ['jspdf', 'jspdf-autotable', 'pdf-lib', 'html2canvas'],
          editor: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-link', '@tiptap/extension-text-align', '@tiptap/extension-underline'],
          timeline: ['vis-data', 'vis-timeline'],
          three: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          excel: ['exceljs']
        }
      }
    }
  },
  test: {
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}', 'tests/utils/**/*.{test,spec}.{js,ts}', 'tests/services/**/*.{test,spec}.{js,ts}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', 'tests/e2e/**'],
  }
} as VitestConfigExport);