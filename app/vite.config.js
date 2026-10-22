import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained dist/index.html (scripts, styles and fonts inlined), so IMD hosts it as it is.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: { outDir: "../dist", emptyOutDir: true, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 },
});
