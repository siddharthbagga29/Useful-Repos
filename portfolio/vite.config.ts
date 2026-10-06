import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from the root of https://siddharthbagga29.github.io/.
// The Jarvis brief lives in ../jarvis/knowledge and is imported at build time,
// so the site and the Python service answer from the same file.
export default defineConfig({
  base: "/",
  plugins: [react()],
  server: { fs: { allow: [".."] } },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 7000, // web-llm is lazy-loaded and only fetched on opt-in
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        lab: resolve(import.meta.dirname, "lab/index.html"),
        deal: resolve(import.meta.dirname, "deal/index.html"),
        research: resolve(import.meta.dirname, "research/index.html"),
      },
    },
  },
});
