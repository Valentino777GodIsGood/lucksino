import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      "/colyseus": {
        target: "http://localhost:2567",
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ""),
      },
      "/store": {
        target: "http://localhost:2567",
      },
      "/auth": {
        target: "http://localhost:2567",
      },
      "/profile": {
        target: "http://localhost:2567",
      },
      "/health": {
        target: "http://localhost:2567",
      },
      "/webhooks": {
        target: "http://localhost:2567",
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  // Env vars prefixed with VITE_ are exposed to the client
  envPrefix: "VITE_",
});
