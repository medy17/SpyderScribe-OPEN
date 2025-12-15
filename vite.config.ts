import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.json";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
  },
  plugins: [crx({ manifest }), react(), tsconfigPaths(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
    hmr: {
      host: "localhost",
      port: 5173,
      protocol: "ws",
    },
  },
});