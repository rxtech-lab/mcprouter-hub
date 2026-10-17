import { syncCatalog } from "@/lib/catalog/sync";

export const maxDuration = 300;

/** Daily Vercel cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await syncCatalog({ budgetMs: 270_000 });
  return Response.json(report);
}
