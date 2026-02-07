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
