/// <reference types="vite/client" />

declare const __BUILD_DATE__: string;

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string;
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
