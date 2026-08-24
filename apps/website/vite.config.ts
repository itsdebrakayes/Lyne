import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
    fs: {
      // legal/*.md is the single source of truth for the published Privacy
      // Policy and Terms, and it lives at the repo root — outside this app.
      // Importing it with ?raw beats retyping legal text into JSX, where the
      // two copies would drift and the published one would be the stale one.
      allow: [path.resolve(__dirname, "../.."), path.resolve(__dirname)],
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
