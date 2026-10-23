import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import fileName from "./tooling/eslint/file-name.mjs";

const lineLimit = (max) => ["error", { max, skipBlankLines: true, skipComments: true }];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: { repository: { rules: { "file-name": fileName } } },
    rules: {
      "repository/file-name": "error",
      "max-lines": lineLimit(500),
      "eqeqeq": ["error", "smart"],
      "curly": ["error", "multi-line"],
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": ["error", "always"],
    },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "function", format: ["camelCase", "PascalCase"], leadingUnderscore: "allow" },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        // Destructured keys can be provider-owned snake_case API fields.
        { selector: "variable", modifiers: ["destructured"], format: null },
      ],
    },
  },
  // Legacy files may shrink, but cannot grow. Remove each override after splitting
  // the file below 500 code lines; do not raise these ceilings for new changes.
  ...[
    ["mcp/apps/runtime.ts", 508],
    ["mcp/services/censtatd-financial-markets/contract.ts", 541],
    ["tests/mcp-route.test.ts", 714],
    ["tests/tools.test.ts", 2782],
  ].map(([file, max]) => ({ files: [file], rules: { "max-lines": lineLimit(max) } })),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "generated/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
