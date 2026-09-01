/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_ID?: 'DD' | 'DE';
  readonly VITE_DEMO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
