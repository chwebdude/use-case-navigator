// See: https://vitejs.dev/guide/env-and-mode.html#intellisense-for-typescript

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POCKETBASE_URL?: string;
  // Add other env variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
