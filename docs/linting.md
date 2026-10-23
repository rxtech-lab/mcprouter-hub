# Linting

Run `bun run lint` before committing. CI runs the same command and fails on
errors or warnings. Use `bun run lint:fix` to apply available automatic fixes;
file names, identifier names and oversized files require manual changes.

The repository extends its existing Next.js Core Web Vitals and TypeScript
ESLint configurations in `eslint.config.mjs` with these rules:

| Area | Enforced convention |
| --- | --- |
| File length | Maximum **500 code lines** per JavaScript/TypeScript file, excluding blank and comment-only lines. Split large modules into focused files. |
| File names | Lowercase **kebab-case**, with dot suffixes such as `.test.ts`, `.spec.ts`, `.config.mjs` and `.d.ts`. Next.js routing directories such as `[id]` and `(dashboard)` are unaffected. |
| TypeScript types | Classes, interfaces, type aliases, enums and type parameters use **PascalCase**. |
| TypeScript functions | **camelCase**, or **PascalCase** for React components. A leading underscore is allowed. |
| TypeScript variables | **camelCase**, **PascalCase** for components/classes/schemas, or **UPPER_CASE** for constants. A leading underscore is allowed. Destructured provider field names are exempt. |
| Coding style | `const` when never reassigned; no `var`; object shorthand; braces for multiline control flow; strict equality except null checks and other safe comparisons allowed by `eqeqeq: smart`. |

Object properties, imported names and function parameters retain their existing
conventions; external API field names do not need rewriting. Existing Next.js,
React, accessibility and TypeScript checks remain enabled.

Four legacy files have explicit ceilings at their current sizes to prevent
growth without requiring a broad rewrite in this tooling change:

| File | Code-line ceiling |
| --- | ---: |
| `mcp/apps/runtime.ts` | 508 |
| `mcp/services/censtatd-financial-markets/contract.ts` | 541 |
| `tests/mcp-route.test.ts` | 714 |
| `tests/tools.test.ts` | 2782 |

Do not increase these ceilings. Remove an override once the file is split below
500 code lines. New files always use the default limit.

Generated code in `generated/`, Next.js/build output, coverage and Playwright
reports are excluded. Edit their source or generator instead. The file-name rule
is a small local ESLint rule in `tooling/eslint/file-name.mjs`; all other rules
come from the existing ESLint dependencies.

`tests/lint-config.test.ts` checks the loaded configuration against passing and
failing source snippets, including the 500/501 boundary, legacy ceilings,
identifier names, Next.js paths, style violations and generated-file exclusions.
