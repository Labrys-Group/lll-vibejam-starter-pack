import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

// Multi-page build: a landing page at `/` and the sandbox at `/game/`.
// `rolldownOptions` is Vite 8's bundler config key (`rollupOptions` is a
// deprecated alias). `public/` is served at the site root, so the GLTF
// assets and manifest are reached as `/assets.json` and `/assets/...`.
export default defineConfig(({ mode }) => {
  // Read non-`VITE_`-prefixed vars too (empty prefix) — `TOKEN_UPSTREAM` is a
  // server-only value consumed here, never exposed to the browser bundle.
  const env = loadEnv(mode, import.meta.dirname, "");

  return {
    build: {
      rolldownOptions: {
        input: {
          main: resolve(import.meta.dirname, "index.html"),
          game: resolve(import.meta.dirname, "game/index.html"),
        },
      },
    },
    // Dev-only token-server proxy. The external token server (ngrok tunnel) does
    // not send CORS headers, so the browser can't read its responses directly.
    // Instead the game fetches the SAME-ORIGIN `/token` (set `VITE_TOKEN_ENDPOINT="/"`)
    // and Vite relays it server-to-server to `TOKEN_UPSTREAM` — no CORS in play.
    // `ngrok-skip-browser-warning` bypasses ngrok-free's HTML interstitial so the
    // JSON token body comes through. Only active under `pnpm dev`; production must
    // rely on real CORS or a same-origin deploy.
    server: env.TOKEN_UPSTREAM
      ? {
          proxy: {
            "/token": {
              target: env.TOKEN_UPSTREAM,
              changeOrigin: true,
              headers: { "ngrok-skip-browser-warning": "true" },
            },
          },
        }
      : undefined,
  };
});
