import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained page (scripts, styles and fonts inlined). `npm run build` copies it to the repository root as
// index.html, the file the IMD site job publishes: IMD's import-site step writes dist/ itself.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 },
});
