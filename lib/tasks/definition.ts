import { z } from "zod";
import { parseTaskCron } from "./cron";

export const scriptSchema = z.array(z.object({
  tool: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,199}$/),
  arguments: z.record(z.string(), z.unknown()).default({}),
})).max(20);
export const taskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(8000),
  script: z.string().max(32_000).default("[]").superRefine((value, context) => {
    try { scriptSchema.parse(JSON.parse(value)); } catch { context.addIssue({ code: "custom", message: "Script must be a JSON array of up to 20 MCP tool calls" }); }
  }),
  cronExpression: z.string().trim().max(120).nullable().default(null).describe("Recurring schedule: five cron fields (minute hour day-of-month month day-of-week), e.g. 0 9 * * 1-5. Null for a one-time task."),
  timeZone: z.string().trim().min(1).max(100).default("UTC").refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Enter a valid IANA time zone, such as Asia/Shanghai").describe("IANA time zone for cron, e.g. Asia/Shanghai; defaults to UTC."),
  runAt: z.iso.datetime({ offset: true }).optional().describe("Required only for one-time tasks: future ISO timestamp with a UTC offset. Omit for cron schedules."),
}).superRefine((data, context) => {
  if (data.cronExpression !== null) {
    try { nextCronOccurrence(data.cronExpression, data.timeZone, new Date()); }
    catch { context.addIssue({ code: "custom", path: ["cronExpression"], message: "Enter a valid minute-based cron expression: minute hour day-of-month month day-of-week" }); }
  } else if (!data.runAt) {
    context.addIssue({ code: "custom", path: ["runAt"], message: "Choose a time for a one-time task or supply a cron expression" });
  }
});
export type TaskDefinition = z.infer<typeof taskSchema>;

/** Calendar recurrence, strictly after now; missed occurrences are skipped. */
export function nextCronOccurrence(expression: string, timeZone: string, now: Date) {
  return parseTaskCron(expression, timeZone, now).next().toDate();
}
