import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/material-balance-lab/",
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { plotly: ["plotly.js-basic-dist-min"], math: ["katex"] },
      },
    },
  },
  test: { include: ["src/tests/**/*.test.ts"] },
});
