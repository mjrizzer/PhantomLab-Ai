import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: { graph: ["@xyflow/react"], charts: ["recharts"] },
      },
    },
  },
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["mark.svg"],
      manifest: {
        name: "PhantomLab — Local Laboratory",
        short_name: "PhantomLab",
        description: "Reproducible software investigations, offline.",
        theme_color: "#F5F1E8",
        background_color: "#F5F1E8",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/mark.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/demo/],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8765",
      "/demo": "http://127.0.0.1:8765",
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": "http://127.0.0.1:8765",
      "/demo": "http://127.0.0.1:8765",
    },
  },
});
