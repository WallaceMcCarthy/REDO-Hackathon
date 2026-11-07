import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// maplibre-gl v6 spawns its worker from a sibling file; pre-bundling would move the main file away from it.
export default defineConfig({ plugins: [react()], optimizeDeps: { exclude: ["maplibre-gl"] } });
