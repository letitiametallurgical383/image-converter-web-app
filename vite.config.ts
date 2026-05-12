import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "public",
      filename: "service-worker.js",
      outDir: "dist",
      injectRegister: null,
      manifest: false,
      injectManifest: {
        injectionPoint: undefined,
        globPatterns: ["**/*.{js,css,wasm,html,svg,png,webp,json}"],
        globIgnores: ["service-worker.js"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@domain": fileURLToPath(new URL("./src/domain", import.meta.url)),
      "@data": fileURLToPath(new URL("./src/data", import.meta.url)),
      "@presentation": fileURLToPath(
        new URL("./src/presentation", import.meta.url),
      ),
      "@utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
      "@workers": fileURLToPath(new URL("./src/workers", import.meta.url)),
    },
  },
  worker: {
    format: "es",
  },
  build: {
    target: "es2022",
    sourcemap: "hidden",
  },
});
