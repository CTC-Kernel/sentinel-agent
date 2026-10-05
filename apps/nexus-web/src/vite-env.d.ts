/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" builds the explicit demonstration mode (see src/demo.ts). */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
