import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { taskSchema } from "./definition";
import { listTasks, saveTask } from "./store";

export const TASK_NOTE = `Signed-in users can schedule work. Use list_scheduled_tasks to inspect their tasks. To draft a schedule or write an MCP workflow script, use draft_scheduled_task. It saves a PAUSED task and returns a review link; in bot replies include its absolute reviewUrl. The user enables it on that page. Never claim it is active. Discover actual tool names before writing scripts. Scripts are JSON arrays of {tool, arguments}, up to 20 sequential calls, using exact MCP tool names, including the oauth_ prefix for external connections. No JavaScript, shell, credentials, loops or filesystem access. Ask for missing schedule details. For recurring tasks write cronExpression as a standard numeric five-field cron (minute hour day-of-month month day-of-week), e.g. "0 9 * * 1-5" for weekdays at 09:00, with an IANA timeZone such as Asia/Shanghai (default UTC). Do not supply runAt for cron schedules: the server computes the next matching occurrence. For a one-time task set cronExpression to null and supply runAt with a UTC offset. All runs create a chat with their result. No interactive input is available during scheduled runs.`;

export function taskTools(userId: string) {
  return {
    list_scheduled_tasks: tool({
      description: "List the signed-in user's scheduled tasks, including IDs, instructions, cron expression, time zone, next run and enabled state.",
      inputSchema: z.object({}).strict(),
      execute: async () => (await listTasks(userId)).map(({ id, title, prompt, enabled, nextRunAt, cronExpression, timeZone }) => ({ id, title, prompt, enabled, nextRunAt, cronExpression, timeZone })),
    }),
    draft_scheduled_task: tool({
      description: "Write task instructions, a cron expression with time zone, and an optional MCP workflow script as a paused task for the user to review and enable. This never starts it automatically.",
      inputSchema: taskSchema,
      execute: async (input) => {
        const id = await saveTask(userId, input, undefined, false);
        const href = `/tasks/${id}`;
        return { href, reviewUrl: process.env.APP_URL ? new URL(href, process.env.APP_URL).href : href, label: "Review scheduled task", enabled: false };
      },
    }),
  };
}
