import { timingSafeEqual } from "node:crypto";
import { runDueTasks } from "@/lib/tasks/runner";

export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const origin = process.env.APP_URL;
  if (!origin) return Response.json({ error: "APP_URL must be configured" }, { status: 503 });
  return Response.json({ runs: await runDueTasks(new URL(origin).origin) });
}
