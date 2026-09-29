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
