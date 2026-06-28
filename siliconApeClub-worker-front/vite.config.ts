import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api/worker-platform": "http://localhost:3010",
      "/health": "http://localhost:3010"
    }
  },
  build: {
    outDir: "dist"
  }
});
