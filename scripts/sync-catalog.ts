/**
 * Catalogue sync from a terminal, without the cron's time budget:
 *   bun run catalog:sync             fetch metadata for every dataset
 *   bun run catalog:sync --limit 100 fetch at most 100
 */
import { syncCatalog } from "../lib/catalog/sync";

const limitIndex = process.argv.indexOf("--limit");
const maxShow = limitIndex > -1 ? Number(process.argv[limitIndex + 1]) : 10_000;

const report = await syncCatalog({ maxShow, concurrency: 8, budgetMs: 60 * 60 * 1000 });
console.log(report);
