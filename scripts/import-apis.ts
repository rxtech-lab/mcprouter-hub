/**
 * Adds every DATA.GOV.HK dataset that mcp/apis.yaml doesn't list yet, with the next ids, then run `bun run codegen`:
 *   bun run apis:import            append new datasets
 *   bun run apis:import --dry-run  only report how many would be added
 */
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { importApis, type CatalogPackage } from "../mcp/apis-import";

const root = path.resolve(import.meta.dirname, "..");
const file = path.join(root, "mcp/apis.yaml");
const CKAN = "https://data.gov.hk/en-data/api/3/action";

async function call<T>(action: string, params: Record<string, string> = {}, attempt = 1): Promise<T> {
  const url = new URL(`${CKAN}/${action}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`answered ${response.status}`);
    const body = (await response.json()) as { success: boolean; result: T };
    if (!body.success) throw new Error("failed");
    return body.result;
  } catch (error) {
    if (attempt >= 3) throw new Error(`CKAN ${action} ${JSON.stringify(params)}: ${(error as Error).message}`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    return call(action, params, attempt + 1);
  }
}

const ids = await call<string[]>("package_list");
const live = new Set(ids);
// The bulk listing only covers part of the catalogue (its search index); package_show fills in the rest.
const packages = new Map<string, CatalogPackage>();
for (let offset = 0; ; offset += 1000) {
  const page = await call<CatalogPackage[]>("current_package_list_with_resources", { limit: "1000", offset: String(offset) });
  for (const pkg of page) packages.set(pkg.name, pkg);
  if (page.length < 1000) break;
}

const yaml = readFileSync(file, "utf8");
const listed = new Set((parseYaml(yaml) as { apis: Array<{ datasets: string[] }> }).apis.flatMap((entry) => entry.datasets));
const missing = ids.filter((id) => !packages.has(id) && !listed.has(id));
console.log(`${ids.length} datasets in the catalogue; fetching ${missing.length} individually…`);

let index = 0;
let failed = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (index < missing.length) {
      const id = missing[index++];
      try {
        packages.set(id, await call<CatalogPackage>("package_show", { id }));
      } catch (error) {
        failed++;
        console.warn((error as Error).message);
      }
      if (index % 250 === 0) console.log(`  ${index} / ${missing.length}`);
    }
  }),
);

const { text, added } = importApis(yaml, [...packages.values()].filter((pkg) => live.has(pkg.name)));
if (!process.argv.includes("--dry-run") && added.length) appendFileSync(file, text);
console.log(
  added.length
    ? `${process.argv.includes("--dry-run") ? "Would add" : "Added"} ${added.length} APIs (${added[0]} to ${added.at(-1)}).${failed ? ` ${failed} datasets failed; run again to add them.` : ""} Now run \`bun run codegen\`.`
    : `mcp/apis.yaml already lists every dataset.${failed ? ` ${failed} datasets failed to load.` : ""}`,
);
