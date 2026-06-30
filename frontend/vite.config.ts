/// <reference types="vitest" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      // HMR pode ser desabilitado via variável de ambiente DISABLE_HMR.
      // Útil para evitar flickering em ambientes de edição automatizada.
      hmr: process.env.DISABLE_HMR !== "true",
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        // ── Coverage scope (F0.5 — "dormente" strategy) ───────────────────────
        // We measure only new product code in src/.
        // The legacy monolith (App.tsx, XmlUploader.tsx, pdfGenerator.ts) is
        // excluded to avoid requiring retro-tests on throwaway code.
        // The ≥70% threshold will be enforced on new feature modules as they
        // are added in F1.x.  This mirrors the F0.4 backend pattern where
        // fail_under=80 is configured but dormant until the packages exist.
        //
        // TODO(F1.9): After monolith removal, remove the legacy excludes and
        // verify ≥70% across all src/** modules.
        // `all: true` instruments every file matched by `include` even if it
        // has no tests, so 0-coverage files are counted rather than omitted.
        // In Vitest 4 the explicit `include` already produces this behaviour,
        // but pinning the flag guards against future default changes.
        all: true,
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          // Test infrastructure
          "src/**/*.test.{ts,tsx}",
          "src/**/*.spec.{ts,tsx}",
          "src/test-setup.ts",
          // Boilerplate entry point
          "src/main.tsx",
          // Legacy monolith — scheduled for deletion in F1.9/F1.10
          "src/App.tsx",
          "src/components/**",
          "src/utils/**",
        ],
        thresholds: {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
      },
    },
  };
});
