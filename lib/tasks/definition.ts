import { z } from "zod";

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
  runAt: z.iso.datetime({ offset: true }),
  intervalMinutes: z.union([z.literal(60), z.literal(1440), z.literal(10080)]).nullable().default(null),
});
export type TaskDefinition = z.infer<typeof taskSchema>;

/** Skip missed intervals rather than replaying a backlog. */
export function nextOccurrence(due: Date, interval: number | null, now: Date) {
  if (!interval) return null;
  const period = interval * 60_000;
  return new Date(due.getTime() + Math.max(1, Math.floor((now.getTime() - due.getTime()) / period) + 1) * period);
}
