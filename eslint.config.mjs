import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      "allure-report/**",
      "allure-results/**",
      "playwright-report/**",
      "test-results/**",
      "dist/**",
      "*.config.ts",
      "global-setup.ts"
    ],
  },
  {
    // v1 was retired (see docs/17-v1-retirement.md). This rule keeps imports to the legacy
    // code or to the old root lib/ from coming back.
    files: ["v2/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          "patterns": [
            {
              "group": ["**/v1/**", "../../lib/*", "../../../lib/*"],
              "message": "v1 and the root lib/ were retired: use the modules inside v2/ (see docs/14-v2-scalable-architecture.md)."
            }
          ]
        }
      ]
    }
  },
  {
    // domain/ is pure business knowledge (docs/14): it must not depend on Playwright, Allure or on
    // the layers above it. A flat-config block replaces the rule options, so the v1 patterns repeat.
    files: ["v2/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          "paths": [
            { "name": "@playwright/test", "message": "domain/ is pure: no Playwright (docs/14)." },
            { "name": "allure-js-commons", "message": "domain/ is pure: reporting belongs to services/evidence." }
          ],
          "patterns": [
            {
              "group": ["**/v1/**", "../../lib/*", "../../../lib/*"],
              "message": "v1 and the root lib/ were retired: use the modules inside v2/ (see docs/14-v2-scalable-architecture.md)."
            },
            {
              // domain files live in domain/<area>/, so "../../<layer>" is a v2/ layer above domain/
              "group": [
                "../../test-data", "../../test-data/**", "../../page-objects/**", "../../services", "../../services/**",
                "../../workflows/**", "../../infrastructure/**", "../../runtime/**", "../../lib/**", "../../adapters/**",
                "../../evidence", "../../evidence/**", "../../diagnostics/**", "../../parsers/**", "../../config/**"
              ],
              "message": "domain/ is the bottom layer: it may only import other domain/ modules (docs/14)."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["**/*.ts"],
    rules: {
      // Allow console.log for debugging in tests
      "no-console": "off",
      // Allow any types for test flexibility
      "@typescript-eslint/no-explicit-any": "off",
      // Allow unused vars that start with underscore
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ],
      // Allow empty object patterns for Playwright fixtures
      "no-empty-pattern": "off"
    }
  }
);
