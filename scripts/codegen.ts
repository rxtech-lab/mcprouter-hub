/**
 * YAML → generated/. Usage:
 *   bun run codegen          write generated files
 *   bun run codegen --check  fail if generated files are out of date
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CodegenError, findExports, generate, type ServiceSource } from "../mcp/codegen";

const root = path.resolve(import.meta.dirname, "..");
const servicesDir = path.join(root, "mcp/services");
const check = process.argv.includes("--check");

// The CLI runs under Bun (`bun run codegen`); this is the one Bun API it uses.
declare const Bun: {
  build(options: { entrypoints: string[]; target: "browser"; format: "iife"; minify: boolean }): Promise<{
    success: boolean;
    logs: unknown[];
    outputs: Array<{ text(): Promise<string> }>;
  }>;
};

/** An MCP App's `app.ts` and the shared runtime it imports, as one browser script for the resource HTML. */
async function bundleApp(entry: string) {
  const result = await Bun.build({ entrypoints: [entry], target: "browser", format: "iife", minify: true });
  if (!result.success) {
    console.error(`Could not bundle ${path.relative(root, entry)}:`);
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  return (await result.outputs[0].text()).trim();
}

async function readSources(): Promise<ServiceSource[]> {
  const entries = readdirSync(servicesDir, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && existsSync(path.join(servicesDir, entry.name, "service.yaml")),
  );
  return Promise.all(
    entries.map(async (entry) => {
      const handlersPath = path.join(servicesDir, entry.name, "handlers.ts");
      const appPath = path.join(servicesDir, entry.name, "app.ts");
      return {
        directory: entry.name,
        yaml: readFileSync(path.join(servicesDir, entry.name, "service.yaml"), "utf8"),
        handlerExports: existsSync(handlersPath) ? findExports(readFileSync(handlersPath, "utf8")) : null,
        appScript: existsSync(appPath) ? await bundleApp(appPath) : null,
      };
    }),
  );
}

let files: Map<string, string>;
try {
  files = generate(await readSources(), readFileSync(path.join(root, "mcp/apps/styles.css"), "utf8"));
} catch (error) {
  if (error instanceof CodegenError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const generatedServicesDir = path.join(root, "generated/services");
const stale = existsSync(generatedServicesDir)
  ? readdirSync(generatedServicesDir)
      .map((name) => `generated/services/${name}`)
      .filter((file) => !files.has(file))
  : [];

if (check) {
  const outdated = [...files].filter(([file, content]) => {
    const target = path.join(root, file);
    return !existsSync(target) || readFileSync(target, "utf8") !== content;
  });
  if (outdated.length || stale.length) {
    console.error("Generated code is out of date. Run `bun run codegen` and commit the result.");
    for (const [file] of outdated) console.error(`  changed: ${file}`);
    for (const file of stale) console.error(`  stale:   ${file}`);
    process.exit(1);
  }
  console.log(`Generated code is up to date (${files.size} files).`);
} else {
  mkdirSync(generatedServicesDir, { recursive: true });
  for (const file of stale) rmSync(path.join(root, file));
  for (const [file, content] of files) writeFileSync(path.join(root, file), content);
  console.log(`Wrote ${files.size} files${stale.length ? `, removed ${stale.length} stale` : ""}.`);
}
