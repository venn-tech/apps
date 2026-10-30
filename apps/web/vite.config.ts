import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // a porta da API vem do mesmo .env da raiz usado pelo back (PORT)
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "");
  const apiPort = env.PORT || "3334";
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: { port: 5173, strictPort: true, proxy: { "/api": `http://localhost:${apiPort}` } },
  };
});
