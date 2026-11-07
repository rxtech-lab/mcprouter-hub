import "server-only";
import { tool } from "ai";
import { taskSchema } from "./definition";
import { listTasks, saveTask } from "./store";

export const TASK_NOTE = `Signed-in users can schedule work. Use list_scheduled_tasks to inspect their tasks. To draft a schedule or write an MCP workflow script, use draft_scheduled_task. It saves a PAUSED task and returns a review link; in bot replies include its absolute reviewUrl. The user enables it on that page. Never claim it is active. Scripts are JSON arrays of {tool, arguments}, up to 20 sequential calls, using exact discovered MCP tool names, including the oauth_ prefix for external connections. No JavaScript, shell, credentials, loops or filesystem access. Ask for missing schedule details. runAt must include a UTC offset; hourly/daily/weekly repeats are fixed elapsed intervals (daily is 24 hours, not DST wall time). All runs create a chat with their result. No interactive input is available during scheduled runs.`;

export function taskTools(userId: string) {
  return {
    list_scheduled_tasks: tool({
      description: "List the signed-in user's scheduled tasks, including IDs, instructions, schedule and enabled state.",
      inputSchema: taskSchema.pick({}).strict(),
      execute: async () => (await listTasks(userId)).map(({ id, title, prompt, enabled, nextRunAt, intervalMinutes }) => ({ id, title, prompt, enabled, nextRunAt, intervalMinutes })),
    }),
    draft_scheduled_task: tool({
      description: "Write an MCP workflow script and schedule as a paused task for the user to review and enable. This never starts it automatically.",
      inputSchema: taskSchema,
      execute: async (input) => {
        const id = await saveTask(userId, input, undefined, false);
        const href = `/tasks/${id}`;
        return { href, reviewUrl: process.env.APP_URL ? new URL(href, process.env.APP_URL).href : href, label: "Review scheduled task", enabled: false };
      },
    }),
  };
}
