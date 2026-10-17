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

function readSources(): ServiceSource[] {
  return readdirSync(servicesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(servicesDir, entry.name, "service.yaml")))
    .map((entry) => {
      const handlersPath = path.join(servicesDir, entry.name, "handlers.ts");
      return {
        directory: entry.name,
        yaml: readFileSync(path.join(servicesDir, entry.name, "service.yaml"), "utf8"),
        handlerExports: existsSync(handlersPath) ? findExports(readFileSync(handlersPath, "utf8")) : null,
      };
    });
}

let files: Map<string, string>;
try {
  files = generate(readSources());
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
