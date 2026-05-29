import { resolve } from "node:path";
import { defineConfig } from "vite";

// Multi-page build: a landing page at `/` and the sandbox at `/game/`.
// `rolldownOptions` is Vite 8's bundler config key (`rollupOptions` is a
// deprecated alias). `public/` is served at the site root, so the GLTF
// assets and manifest are reached as `/assets.json` and `/assets/...`.
export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        game: resolve(import.meta.dirname, "game/index.html"),
      },
    },
  },
});
