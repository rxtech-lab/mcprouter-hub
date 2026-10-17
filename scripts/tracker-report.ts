/** Prints the tracker summary for CI and pull requests: `bun run tracker:report [--markdown]`. */
import { isNull } from "drizzle-orm";
import { db } from "../db";
import { datasets, datasetStatus } from "../db/schema";
import manifest from "../generated/manifest.json";
import { percent, resolveRows, STATUS_LABELS, summarise, TRACKER_STATUSES, type ManualStatus } from "../lib/tracker";

const markdown = process.argv.includes("--markdown");
const rows = await db.select().from(datasets).where(isNull(datasets.removedAt));
const statuses = await db.select().from(datasetStatus);
const manual = new Map<string, ManualStatus>(statuses.map((row) => [row.datasetId, row]));
const summary = summarise(resolveRows(rows, manual, manifest.datasets as Record<string, string[]>));

const converted = Object.keys(manifest.datasets);
const line = (label: string, done: number, total: number) => `${label.padEnd(44)} ${String(done).padStart(5)} / ${String(total).padEnd(5)} ${percent(done, total).padStart(6)}`;

if (rows.length === 0) {
  console.log(`Catalogue not synced (run \`bun run catalog:sync\`). Services in the manifest cover ${converted.length} datasets.`);
  process.exit(0);
}

if (markdown) {
  console.log(`### mcprouter conversion: ${summary.overall.converted} / ${summary.overall.total} datasets (${percent(summary.overall.converted, summary.overall.total)})\n`);
  console.log(`| Status | Datasets |\n|---|---|`);
  for (const status of TRACKER_STATUSES) console.log(`| ${STATUS_LABELS[status]} | ${summary.overall.counts[status]} |`);
  console.log(`\nReal API endpoints: ${summary.apiOnly.converted} / ${summary.apiOnly.total}`);
} else {
  console.log(line("All datasets", summary.overall.converted, summary.overall.total));
  console.log(line("Real API endpoints", summary.apiOnly.converted, summary.apiOnly.total));
  console.log(`  ${TRACKER_STATUSES.map((status) => `${STATUS_LABELS[status]}: ${summary.overall.counts[status]}`).join(" · ")}`);
  console.log("\nBy category");
  for (const group of summary.byCategory) console.log(line(`  ${group.label}`, group.converted, group.total));
  console.log("\nTop providers");
  for (const provider of summary.byProvider.slice(0, 15)) console.log(line(`  ${provider.label.slice(0, 40)}`, provider.converted, provider.total));
}
