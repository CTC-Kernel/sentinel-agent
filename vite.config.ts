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
  esbuild: {
    drop: ['console', 'debugger'],
  },
  plugins: [
    react({ jsxRuntime: 'automatic' }),
    tsconfigPaths({ ignoreConfigErrors: true }),
    VitePWA({
      registerType: 'prompt', // Better for manual handling and visibility
      injectRegister: 'auto',
      includeAssets: ['favicon.webp'],
      manifest: {
        name: 'Sentinel GRC',
        short_name: 'Sentinel',
        description: 'Plateforme de Gouvernance, Risque et Conformité',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB limit
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2,html}'],
        // Force immediate update - no waiting for all tabs to close
        skipWaiting: true,
        clientsClaim: true,
        // Clean up old caches automatically
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/index.html' || url.pathname === '/',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'index-cache',
              expiration: {
                maxEntries: 1,
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          },
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
                statuses: [200]
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
        headers: {
          Origin: 'https://app.cyber-threat-consulting.com' // Spoof Origin for CORS
        }
      }
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 8080
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
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          // === REACT CORE ===
          if (id.includes('/react-dom/') || id.includes('/react-dom@')) return 'vendor-react';
          if (id.includes('/react-router-dom/') || id.includes('/react-router/')) return 'vendor-react';
          if (id.includes('/react/') || id.includes('react/jsx')) return 'vendor-react';

          // === RADIX UI ===
          if (id.includes('@radix-ui')) return 'vendor-radix';

          // === FIREBASE - split by service ===
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) return 'firebase-auth';
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) return 'firebase-firestore';
          if (id.includes('@firebase/storage') || id.includes('firebase/storage')) return 'firebase-misc';
          if (id.includes('@firebase/functions') || id.includes('firebase/functions')) return 'firebase-misc';
          if (id.includes('@firebase/analytics') || id.includes('firebase/analytics')) return 'firebase-analytics';
          if (id.includes('firebase/app') || id.includes('@firebase/app')) return 'firebase-core';
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase-core';

          // === 3D ENGINE (very heavy - lazy load only) ===
          if (id.includes('@react-three/')) return 'three';
          if (id.includes('@react-spring/three')) return 'three';
          if (id.includes('three')) return 'three';

          // === PDF GENERATION (heavy - lazy load) ===
          if (id.includes('jspdf')) return 'pdf';
          if (id.includes('pdf-lib')) return 'pdf';
          if (id.includes('html2canvas')) return 'pdf';

          // === EXCEL (heavy - lazy load) ===
          if (id.includes('exceljs')) return 'excel';

          // === CHARTS ===
          if (id.includes('recharts')) return 'charts';
          if (id.includes('d3-')) return 'charts';

          // === FRAMER MOTION ===
          if (id.includes('framer-motion')) return 'framer-motion';

          // === TIMELINE ===
          if (id.includes('vis-timeline') || id.includes('vis-data')) return 'timeline';
          if (id.includes('react-big-calendar')) return 'calendar';

          // === RICH TEXT EDITOR ===
          if (id.includes('@tiptap') || id.includes('tiptap') || id.includes('prosemirror')) return 'editor';

          // === STATE & DATA ===
          if (id.includes('zustand')) return 'state';
          if (id.includes('@tanstack/react-query')) return 'state';
          if (id.includes('@tanstack/react-table')) return 'ui-table';

          // === UI LIBRARIES ===
          if (id.includes('@headlessui')) return 'ui-headless';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('@dnd-kit')) return 'ui-dnd';

          // === FORMS ===
          if (id.includes('react-hook-form') || id.includes('@hookform')) return 'forms';
          if (id.includes('zod')) return 'forms';

          // === GOOGLE AI ===
          if (id.includes('@google/generative-ai')) return 'ai-gemini';

          // === I18N ===
          if (id.includes('i18next')) return 'i18n';

          // === SENTRY ===
          if (id.includes('@sentry')) return 'monitoring';

          // === UTILS ===
          if (id.includes('date-fns')) return 'utils';
          if (id.includes('lodash')) return 'utils';
          if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) return 'utils-css';
          if (id.includes('dompurify')) return 'security';
          if (id.includes('jszip')) return 'security';
          if (id.includes('crypto-js')) return 'security';

          // === REACT ADDONS ===
          if (id.includes('react-markdown') || id.includes('remark')) return 'markdown';
          if (id.includes('react-syntax-highlighter') || id.includes('prismjs') || id.includes('refractor')) return 'syntax-highlight';
          if (id.includes('react-simple-maps') || id.includes('d3-geo') || id.includes('topojson')) return 'maps';
          if (id.includes('react-spring') || id.includes('@react-spring')) return 'animations-spring';
          if (id.includes('gantt-task-react')) return 'gantt';
          if (id.includes('react-diff-viewer')) return 'diff-viewer';
          if (id.includes('react-dropzone')) return 'ui-dropzone';
          if (id.includes('react-tooltip')) return 'ui-tooltip';
          if (id.includes('react-helmet')) return 'seo';
          if (id.includes('react-hotkeys') || id.includes('hotkeys')) return 'ui-hotkeys';
          if (id.includes('react-signature')) return 'signature';
          if (id.includes('react-day-picker')) return 'ui-datepicker';
          if (id.includes('driver.js')) return 'onboarding';
          if (id.includes('sonner')) return 'ui-toast';
          if (id.includes('nprogress')) return 'ui-progress';
          if (id.includes('canvas-confetti')) return 'effects';
          if (id.includes('qrcode')) return 'utils-qr';
          if (id.includes('uuid')) return 'utils-uuid';
          if (id.includes('file-saver')) return 'utils-filesaver';

          // Catch-all for remaining node_modules
          return 'vendor-misc';
        }
      }
    }
  },
  test: {
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  }
} as VitestConfigExport);