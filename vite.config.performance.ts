/**
 * Configuration Vite optimisée pour les performances
 *
 * Améliorations par rapport à la config de base:
 * - Code splitting plus granulaire
 * - Compression Brotli activée
 * - Tree-shaking optimisé
 * - Cache amélioré
 * - Bundle analyzer intégré
 */

import path from "path"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// import { visualizer } from 'rollup-plugin-visualizer';
import type { InlineConfig } from 'vitest';
import type { UserConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
// import viteCompression from 'vite-plugin-compression';

interface VitestConfigExport extends UserConfig {
  test: InlineConfig;
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    esbuild: {
      // Supprimer console.log et debugger en production uniquement
      drop: isProd ? ['console', 'debugger'] : [],
      // Optimiser la minification
      legalComments: 'none',
      treeShaking: true,
    },

    plugins: [
      react({
        // Optimisations React
        babel: {
          plugins: [
            // Supprimer les PropTypes en production
            ...(isProd ? [['babel-plugin-transform-remove-console']] : []),
          ].filter(Boolean),
        },
      }),

      tsconfigPaths({ ignoreConfigErrors: true }),

      // PWA
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
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
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
          // Cache strategies améliorées
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'firebase-storage-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 60 // 60 days
                }
              }
            }
          ]
        }
      }),

      // Compression Gzip
      // Compression Gzip
      /* viteCompression({
        verbose: true,
        disable: !isProd,
        threshold: 10240,
        algorithm: 'gzip',
        ext: '.gz',
      }), */

      // Compression Brotli (meilleure que Gzip)
      /* viteCompression({
        verbose: true,
        disable: !isProd,
        threshold: 10240,
        algorithm: 'brotliCompress',
        ext: '.br',
      }), */

      // Bundle analyzer (seulement en mode analyze)
      /* mode === 'analyze' && visualizer({
        filename: './dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap', // 'sunburst', 'treemap', 'network'
      }), */
    ].filter(Boolean),

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
      sourcemap: isProd ? false : true,
      minify: isProd ? 'esbuild' : false,
      // Réduire le warning à 500KB
      chunkSizeWarningLimit: 500,
      // Optimisations CSS
      cssCodeSplit: true,
      cssMinify: isProd,

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

          // Code splitting manuel amélioré
          manualChunks: (id) => {
            // Node modules
            if (id.includes('node_modules')) {
              // React ecosystem
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor';
              }

              // Firebase - Splitter par module
              if (id.includes('firebase/app')) return 'firebase-core';
              if (id.includes('firebase/auth')) return 'firebase-auth';
              if (id.includes('firebase/firestore')) return 'firebase-firestore';
              if (id.includes('firebase/storage')) return 'firebase-storage';
              if (id.includes('firebase/functions')) return 'firebase-functions';
              if (id.includes('firebase/analytics')) return 'firebase-analytics';

              // Charts - Lazy load
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'charts';
              }

              // 3D - Lazy load (très lourd)
              if (id.includes('three') || id.includes('@react-three')) {
                return '3d-engine';
              }

              // PDF - Lazy load
              if (id.includes('jspdf') || id.includes('pdf-lib') || id.includes('html2canvas')) {
                return 'pdf-tools';
              }

              // Excel - Lazy load
              if (id.includes('exceljs')) {
                return 'excel-tools';
              }

              // Editor - Lazy load
              if (id.includes('@tiptap') || id.includes('tiptap')) {
                return 'rich-editor';
              }

              // UI Libraries
              if (id.includes('framer-motion')) return 'animations';
              if (id.includes('@headlessui') || id.includes('@radix-ui')) return 'ui-primitives';
              if (id.includes('lucide-react')) return 'icons';

              // TanStack
              if (id.includes('@tanstack/react-query')) return 'react-query';
              if (id.includes('@tanstack/react-table')) return 'react-table';

              // Form libraries
              if (id.includes('react-hook-form') || id.includes('zod')) {
                return 'forms';
              }

              // Calendar & Timeline
              if (id.includes('react-big-calendar') || id.includes('vis-timeline')) {
                return 'calendar-timeline';
              }

              // Autres vendors
              return 'vendor-misc';
            }

            // Code de l'application - Splitter par fonctionnalité
            // Routes principales
            if (id.includes('/views/')) {
              if (id.includes('/views/Assets')) return 'page-assets';
              if (id.includes('/views/Risks')) return 'page-risks';
              if (id.includes('/views/Compliance')) return 'page-compliance';
              if (id.includes('/views/Audits')) return 'page-audits';
              if (id.includes('/views/Projects')) return 'page-projects';
              if (id.includes('/views/Incidents')) return 'page-incidents';
              if (id.includes('/views/Documents')) return 'page-documents';
              if (id.includes('/views/Suppliers')) return 'page-suppliers';
              if (id.includes('/views/Privacy')) return 'page-privacy';
              if (id.includes('/views/Continuity')) return 'page-continuity';
              return 'pages-misc';
            }

            // Composants par domaine
            if (id.includes('/components/assets')) return 'comp-assets';
            if (id.includes('/components/risks')) return 'comp-risks';
            if (id.includes('/components/compliance')) return 'comp-compliance';
            if (id.includes('/components/audits')) return 'comp-audits';
            if (id.includes('/components/dashboard')) return 'comp-dashboard';

            // Services
            if (id.includes('/services/')) return 'services';

            // Hooks
            if (id.includes('/hooks/')) return 'hooks';
          },

          // Optimiser les noms de chunks
          chunkFileNames: () => {
            return `assets/js/[name]-[hash].js`;
          },

          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },

        // Optimizations Rollup
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
        },
      },
    },

    // Optimisations de dépendances
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'zustand',
        '@tanstack/react-query',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
      ],
      exclude: [
        // Exclure les modules qui ne doivent pas être pré-bundlés
        '@react-three/fiber',
        '@react-three/drei',
        'three',
      ],
    },

    // Test config
    test: {
      setupFiles: ['./src/setupTests.ts'],
      include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/setupTests.ts',
          '**/*.d.ts',
          '**/*.config.*',
          '**/mockData',
          'tests/',
        ],
      },
    }
  } as VitestConfigExport;
});
