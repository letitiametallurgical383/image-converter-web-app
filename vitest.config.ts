import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/core/**",
        "src/domain/**",
        "src/utils/**",
        "src/data/**",
        "src/workers/metadata.ts",
      ],
      exclude: ["src/**/*.d.ts", "src/main.tsx", "src/App.tsx"],
    },
  },
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
});
