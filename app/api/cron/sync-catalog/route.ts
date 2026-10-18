import { syncCatalog } from "@/lib/catalog/sync";
import { cleanupOAuth } from "@/lib/mcp/oauth";

export const maxDuration = 300;

/** Daily Vercel cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // The daily run also drops expired OAuth codes, tokens and grants.
  await cleanupOAuth().catch((error) => console.error("[cron] OAuth cleanup failed", error));
  const report = await syncCatalog({ budgetMs: 270_000 });
  return Response.json(report);
}
