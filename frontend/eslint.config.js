// ESLint flat config (ESLint 9) — Simples Apuração RTC (F0.5)
//
// Stack: typescript-eslint recommended + react + react-hooks + react-refresh.
// eslint-config-prettier is applied last to disable any formatting rules that
// would conflict with Prettier (printWidth 100, singleQuote, etc.).
//
// Design (Opção B — strict by default, legacy exception scoped):
//   All rules are ERROR globally so that every new module written in F1.x
//   is strictly checked from day one.
//
//   The three legacy monolith files (App.tsx / XmlUploader.tsx / server.ts)
//   are included in linting but have select rules demoted to "warn" via the
//   `legacyOverrides` block at the bottom.  Because flat-config entries are
//   applied in order and later entries win, the override block ONLY affects
//   those three files while leaving the global "error" level in place for all
//   new code.
//
// TODO(F1.9/F1.10): Delete the entire `legacyOverrides` block after the
// monolith is removed.  No further rule changes required — the globals are
// already at the correct strictness level.

import js from "@eslint/js";
import tsEslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";

// ── Legacy files (Opção B) ───────────────────────────────────────────────────
const LEGACY_FILES = ["server.ts", "src/App.tsx", "src/components/XmlUploader.tsx"];

export default tsEslint.config(
  // ── Global ignores ──────────────────────────────────────────────────────────
  {
    ignores: ["dist/**", "build/**", "node_modules/**", "coverage/**"],
  },

  // ── Base JS recommended ──────────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript-ESLint recommended ────────────────────────────────────────────
  ...tsEslint.configs.recommended,

  // ── React + Hooks + Refresh ──────────────────────────────────────────────────
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: {
        // Detect React version automatically from package.json.
        version: "detect",
      },
    },
    rules: {
      // React core (recommended subset that works with the new JSX transform)
      ...reactPlugin.configs.recommended.rules,
      // With React 17+ new JSX transform, 'react' does not need to be in scope.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",

      // React Hooks recommended
      ...reactHooks.configs.recommended.rules,

      // React Refresh — warn on non-component exports from component files so
      // HMR works reliably.
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // TypeScript-ESLint — STRICT (error) for all new code.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          // Variables/params prefixed with _ are intentionally unused.
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Disable the base rule in favour of the TypeScript-aware version.
      "no-unused-vars": "off",
    },
  },

  // ── Legacy monolith overrides (TODO F1.9/F1.10 — delete this entire block) ──
  // Demote rules that still produce violations in the legacy files to "warn".
  // Later entries in the flat-config array win, so this only affects LEGACY_FILES.
  // All other files keep the global "error" level — no new code escapes.
  {
    files: LEGACY_FILES,
    rules: {
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "no-var": "warn",
      // These two are error globally; downgrade to warn for the monolith only.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },

  // ── Prettier (must be last — disables conflicting formatting rules) ──────────
  prettierConfig,
);
