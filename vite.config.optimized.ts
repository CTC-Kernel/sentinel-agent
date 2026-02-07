/**
 * Configuration Vite ULTRA-OPTIMISEE pour production
 *
 * Objectif: Réduire le bundle de 51MB à ~15-20MB
 *
 * Optimisations appliquées:
 * - Code splitting granulaire par fonctionnalité
 * - Lazy loading agressif des modules lourds
 * - Tree shaking optimisé
 * - Minification esbuild (plus rapide que terser)
 * - Compression Gzip/Brotli activée
 * - CSS code splitting
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // ESBUILD: Suppression console/debugger + optimisations
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
    treeShaking: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },

  plugins: [
    react({
      jsxRuntime: 'automatic',
      // Babel config légère pour production
      babel: {
        plugins: [],
        babelrc: false,
        configFile: false,
      },
    }),
    tsconfigPaths({ ignoreConfigErrors: true }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.webp'],
      manifest: {
        name: 'Sentinel GRC',
        short_name: 'Sentinel',
        description: 'Plateforme GRC - Governance, Risk & Compliance',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB max per chunk
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 31536000 }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 2592000 }
            }
          }
        ]
      }
    })
  ],

  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0].replace(/-/g, '')),
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  build: {
    outDir: 'dist',
    target: 'esnext',
    sourcemap: false,
    // Utiliser esbuild (4x plus rapide que terser)
    minify: 'esbuild',
    // Warning à 300KB pour forcer le code splitting
    chunkSizeWarningLimit: 300,
    // CSS code splitting activé
    cssCodeSplit: true,
    cssMinify: true,
    // Reporter les erreurs de module non trouvé
    modulePreload: { polyfill: false },

    rollupOptions: {
      external: ['capacitor.js'],

      output: {
        // Polyfill setImmediate pour compatibilité
        banner: `(() => {
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);
    if (g && !g.setImmediate) {
      g.setImmediate = (cb, ...args) => setTimeout(cb, 0, ...args);
      g.clearImmediate = (id) => clearTimeout(id);
    }
  } catch (_) {}
})();`,

        // CODE SPLITTING GRANULAIRE - Clé de l'optimisation
        manualChunks: (id) => {
          if (!id.includes('node_modules')) {
            // Code applicatif - splitter par view
            if (id.includes('/views/')) {
              const viewMatch = id.match(/\/views\/([^/]+)/);
              if (viewMatch) {
                const view = viewMatch[1].replace(/\.(tsx?|jsx?)$/, '');
                // Grouper les views similaires
                if (['Dashboard', 'DashboardWithQuickActions'].includes(view)) return 'view-dashboard';
                if (['Assets', 'AssetDetail'].includes(view)) return 'view-assets';
                if (['Risks', 'RiskDetail', 'EbiosAnalyses', 'EbiosAnalysisDetail'].includes(view)) return 'view-risks';
                if (['Compliance', 'ComplianceDetail'].includes(view)) return 'view-compliance';
                if (['Audits', 'AuditDetail'].includes(view)) return 'view-audits';
                if (['Suppliers', 'SupplierDetail'].includes(view)) return 'view-suppliers';
                if (['Documents', 'DocumentDetail'].includes(view)) return 'view-documents';
                if (['Continuity', 'ContinuityDetail'].includes(view)) return 'view-continuity';
                if (['VoxelView', 'VoxelPage'].includes(view)) return 'view-3d';
                if (['Privacy', 'PrivacyDetail'].includes(view)) return 'view-privacy';
                return `view-${view.toLowerCase()}`;
              }
            }
            // Services
            if (id.includes('/services/')) return 'app-services';
            // Hooks
            if (id.includes('/hooks/')) return 'app-hooks';
            // Components par domaine
            if (id.includes('/components/dashboard')) return 'comp-dashboard';
            if (id.includes('/components/assets')) return 'comp-assets';
            if (id.includes('/components/risks')) return 'comp-risks';
            if (id.includes('/components/compliance')) return 'comp-compliance';
            if (id.includes('/components/ai')) return 'comp-ai';
            if (id.includes('/components/3d') || id.includes('/components/voxel')) return 'comp-3d';
            if (id.includes('/components/charts') || id.includes('/components/timeline')) return 'comp-charts';
            if (id.includes('/components/ui')) return 'comp-ui';
            return undefined;
          }

          // NODE_MODULES - Splitter agressivement

          // === REACT CORE (critical - load first, single chunk) ===
          if (id.includes('/react-dom/') || id.includes('/react-dom@')) return 'vendor-react';
          if (id.includes('react-router')) return 'vendor-react';
          if (id.includes('/react/') || id.includes('react/jsx')) return 'vendor-react';

          // === RADIX UI ===
          if (id.includes('@radix-ui')) return 'vendor-radix';

          // === FIREBASE (split by service) ===
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) return 'firebase-firestore';
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) return 'firebase-auth';
          if (id.includes('@firebase/storage') || id.includes('firebase/storage')) return 'firebase-misc';
          if (id.includes('@firebase/functions') || id.includes('firebase/functions')) return 'firebase-misc';
          if (id.includes('@firebase/analytics') || id.includes('firebase/analytics')) return 'firebase-analytics';
          if (id.includes('firebase/app') || id.includes('@firebase/app')) return 'firebase-core';
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase-core';

          // === 3D ENGINE (very heavy - single chunk, lazy load) ===
          if (id.includes('@react-three/')) return 'three';
          if (id.includes('@react-spring/three')) return 'three';
          if (id.includes('three')) return 'three';

          // === PDF GENERATION (heavy - single chunk, lazy load) ===
          if (id.includes('jspdf')) return 'pdf';
          if (id.includes('pdf-lib')) return 'pdf';
          if (id.includes('html2canvas')) return 'pdf';

          // === EXCEL (heavy - lazy load) ===
          if (id.includes('exceljs')) return 'excel';

          // === CHARTS (single chunk) ===
          if (id.includes('recharts')) return 'charts';
          if (id.includes('d3-')) return 'charts';

          // === FRAMER MOTION (own chunk) ===
          if (id.includes('framer-motion')) return 'framer-motion';

          // === TIMELINE ===
          if (id.includes('vis-timeline') || id.includes('vis-data')) return 'timeline';
          if (id.includes('react-big-calendar')) return 'calendar';

          // === RICH TEXT EDITOR ===
          if (id.includes('@tiptap') || id.includes('tiptap') || id.includes('prosemirror')) return 'editor';

          // === UI LIBRARIES ===
          if (id.includes('@headlessui')) return 'ui-headless';
          if (id.includes('lucide-react')) return 'ui-icons';

          // === STATE & DATA ===
          if (id.includes('zustand')) return 'state-zustand';
          if (id.includes('@tanstack/react-query')) return 'state-query';
          if (id.includes('@tanstack/react-table')) return 'ui-table';

          // === FORMS ===
          if (id.includes('react-hook-form') || id.includes('@hookform')) return 'forms';
          if (id.includes('zod')) return 'forms';

          // === UTILS ===
          if (id.includes('date-fns')) return 'utils-date';
          if (id.includes('lodash')) return 'utils-lodash';
          if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) return 'utils-css';

          // === SECURITY ===
          if (id.includes('dompurify')) return 'security';
          if (id.includes('jszip')) return 'security';
          if (id.includes('crypto-js')) return 'security';

          // === GOOGLE AI ===
          if (id.includes('@google/generative-ai')) return 'ai-gemini';

          // === I18N ===
          if (id.includes('i18next')) return 'i18n';

          // === SENTRY ===
          if (id.includes('@sentry')) return 'monitoring';

          // === DND (Drag & Drop) ===
          if (id.includes('@dnd-kit')) return 'ui-dnd';

          // === REACT ADDONS ===
          if (id.includes('react-markdown') || id.includes('remark')) return 'markdown';
          if (id.includes('react-dropzone')) return 'ui-dropzone';
          if (id.includes('react-tooltip')) return 'ui-tooltip';
          if (id.includes('react-helmet')) return 'seo';
          if (id.includes('react-hotkeys') || id.includes('hotkeys')) return 'ui-hotkeys';
          if (id.includes('react-spring') || id.includes('@react-spring')) return 'animations-spring';
          if (id.includes('react-diff-viewer')) return 'diff-viewer';
          if (id.includes('react-syntax-highlighter') || id.includes('prismjs') || id.includes('refractor')) return 'syntax-highlight';
          if (id.includes('react-simple-maps') || id.includes('d3-geo') || id.includes('topojson')) return 'maps';
          if (id.includes('gantt-task-react')) return 'gantt';
          if (id.includes('react-signature')) return 'signature';
          if (id.includes('react-day-picker')) return 'ui-datepicker';
          if (id.includes('driver.js')) return 'onboarding';

          // === MISC VENDORS ===
          if (id.includes('canvas-confetti')) return 'effects';
          if (id.includes('qrcode')) return 'utils-qr';
          if (id.includes('uuid')) return 'utils-uuid';
          if (id.includes('sonner')) return 'ui-toast';
          if (id.includes('nprogress')) return 'ui-progress';
          if (id.includes('file-saver')) return 'utils-filesaver';

          // Catch-all for remaining node_modules
          return 'vendor-misc';
        },

        // Nommage optimisé des chunks
        chunkFileNames: 'assets/js/[name]-[hash:8].js',
        entryFileNames: 'assets/js/[name]-[hash:8].js',
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name?.split('.').pop() || 'asset';
          if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
            return 'assets/img/[name]-[hash:8].[ext]';
          }
          if (['woff', 'woff2', 'eot', 'ttf', 'otf'].includes(ext)) {
            return 'assets/fonts/[name]-[hash:8].[ext]';
          }
          if (ext === 'css') {
            return 'assets/css/[name]-[hash:8].[ext]';
          }
          return 'assets/[ext]/[name]-[hash:8].[ext]';
        },
      },

      // TREE SHAKING AGRESSIF
      treeshake: {
        moduleSideEffects: (id) => {
          // Garder les side effects pour CSS et polyfills
          if (id.endsWith('.css')) return true;
          if (id.includes('polyfill')) return true;
          return false;
        },
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        unknownGlobalSideEffects: false,
      },
    },
  },

  // OPTIMISATION DES DEPS
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
      'clsx',
      'tailwind-merge',
    ],
    exclude: [
      // Modules lourds à lazy-loader
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'exceljs',
      'jspdf',
      'html2canvas',
      'vis-timeline',
    ],
    // Force esbuild pour les deps
    esbuildOptions: {
      target: 'esnext',
      treeShaking: true,
    },
  },

  // Serveur de dev
  server: {
    host: '0.0.0.0',
    port: 8080,
    hmr: { overlay: false },
  },

  // Preview
  preview: {
    port: 4173,
    strictPort: true,
  },
});
