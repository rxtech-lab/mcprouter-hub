/**
 * Catalogue sync, run daily by .github/workflows/sync-catalog.yml or by hand:
 *   bun run catalog:sync             fetch metadata for every dataset
 *   bun run catalog:sync --limit 100 fetch at most 100
 * Also drops expired OAuth codes, tokens and grants.
 */
import { syncCatalog } from "../lib/catalog/sync";
import { cleanupOAuth } from "../lib/mcp/oauth";

const limitIndex = process.argv.indexOf("--limit");
const maxShow = limitIndex > -1 ? Number(process.argv[limitIndex + 1]) : 10_000;

await cleanupOAuth().catch((error) => console.error("[catalog-sync] OAuth cleanup failed", error));
const report = await syncCatalog({ maxShow, concurrency: 8, budgetMs: 60 * 60 * 1000 });
console.log(report);
