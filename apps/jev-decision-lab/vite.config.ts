import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, type ProxyOptions } from "vite"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const typesafeProxy: ProxyOptions = {
  target: "https://api.typesafe.ai",
  changeOrigin: true,
  rewrite: (requestPath) => requestPath.replace(/^\/api\/typesafe/, ""),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  server: {
    proxy: {
      "/api/typesafe": typesafeProxy,
    },
  },
  preview: {
    proxy: {
      "/api/typesafe": typesafeProxy,
    },
  },
})
