/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Public base URL of the external LiveKit token server (run by the brain team).
   * Optional: when unset the sandbox still loads and `fetchToken` degrades to a
   * typed `no_endpoint` outcome. Not a secret — see `.env.example`.
   */
  readonly VITE_TOKEN_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
