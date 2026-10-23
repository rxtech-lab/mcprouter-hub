import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: path.resolve(import.meta.dirname, "..") });
const lines = (count: number) => 'console.log("ok");\n'.repeat(count);

async function violations(source: string, filePath = "lib/lint-example.ts") {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages.map((message) => message.ruleId);
}

describe("repository lint enforcement", () => {
  it("allows 500 code lines and rejects 501, excluding blanks and comments", async () => {
    expect(await violations(lines(500) + "\n// comment\n/* another comment */\n"))
      .not.toContain("max-lines");
    expect(await violations(lines(501))).toContain("max-lines");
  });

  it.each([
    ["mcp/apps/runtime.ts", 508],
    ["mcp/services/censtatd-financial-markets/contract.ts", 541],
    ["tests/mcp-route.test.ts", 714],
    ["tests/tools.test.ts", 2782],
  ] as const)("blocks growth beyond the legacy ceiling for %s", async (filePath, ceiling) => {
    expect(await violations(lines(ceiling), filePath)).not.toContain("max-lines");
    expect(await violations(lines(ceiling + 1), filePath)).toContain("max-lines");
  });

  it.each(["lib/BadName.ts", "components/bad_name.tsx", "scripts/BadName.mjs"])(
    "rejects non-kebab-case file names: %s",
    async (filePath) => {
      expect(await violations("export {};", filePath)).toContain("repository/file-name");
    },
  );

  it.each([
    "lib/good-name.ts",
    "tests/good-name.test.ts",
    "e2e/good-name.spec.ts",
    "types/good-name.d.ts",
    "next.config.ts",
    "app/(dashboard)/tracker/[id]/page.tsx",
    "app/[...slug]/route.ts",
    "app/opengraph-image.tsx",
    "scripts/good-name.mjs",
  ])("allows repository and Next.js names: %s", async (filePath) => {
    expect(await violations("export {};", filePath)).not.toContain("repository/file-name");
  });

  it("enforces identifier names and preserves provider-owned field names", async () => {
    const invalid = await violations(`
      export type bad_type = string;
      export function bad_function() { return 1; }
      export const bad_variable = 1;
    `);
    expect(invalid.filter((rule) => rule === "@typescript-eslint/naming-convention")).toHaveLength(3);
    expect(await violations(`
      export type GoodType = string;
      export function GoodComponent() { return null; }
      export const MAX_COUNT = 2;
      export const goodVariable = 1;
      const { client_id } = JSON.parse('{}');
      console.log(client_id);
    `)).toEqual([]);
  });

  it("enforces style rules with actionable diagnostics", async () => {
    expect(await violations(`
      var value = 1;
      let stable = 2;
      if (value == stable)
        console.log({ value: value });
    `)).toEqual(expect.arrayContaining([
      "no-var", "prefer-const", "eqeqeq", "curly", "object-shorthand",
    ]));
    expect(await violations(`
      const value = 1;
      if (value != null) console.log({ value });
    `)).toEqual([]);
  });

  it.each([
    "generated/services/example.ts",
    ".next/types/routes.d.ts",
    "coverage/report.js",
    "playwright-report/report.js",
    "test-results/report.js",
    "next-env.d.ts",
  ])("ignores generated/build output: %s", async (filePath) => {
    expect(await eslint.isPathIgnored(filePath)).toBe(true);
  });
});
