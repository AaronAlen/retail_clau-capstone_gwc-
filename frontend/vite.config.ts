import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expose on local network (0.0.0.0) so mobile/tablets can open via 192.168.x.x
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err: any) => {
            if (err?.code === "ECONNRESET" || err?.code === "EPIPE") return;
          });
        },
      },
    },
  },
  build: {
    cssMinify: true,
    cssCodeSplit: true,
    minify: "esbuild",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("three")) {
              return "vendor-three";
            }
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/react-router/") ||
              id.includes("/react-router-dom/") ||
              id.includes("/scheduler/")
            ) {
              return "vendor-react";
            }
            if (id.includes("@reduxjs") || id.includes("react-redux")) {
              return "vendor-redux";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("socket.io-client") || id.includes("axios")) {
              return "vendor-network";
            }
          }
        },
      },
    },
  },
});
