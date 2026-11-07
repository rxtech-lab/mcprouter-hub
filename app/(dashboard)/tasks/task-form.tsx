"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/m3/button";
import { useActionRunner } from "@/components/use-action-runner";
import { saveScheduledTask } from "./actions";

type EditableTask = { id: string; title: string; prompt: string; script: string; intervalMinutes: number | null; nextRunAt: string };
const field = "mt-2 block w-full rounded-md border border-outline bg-surface-container-lowest p-3";

export function TaskForm({ task }: { task?: EditableTask }) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  return <form className="flex max-w-3xl flex-col gap-6" action={(form) => run(() => saveScheduledTask({
    title: form.get("title"), prompt: form.get("prompt"), script: form.get("script"),
    runAt: `${String(form.get("runAt"))}:00Z`, intervalMinutes: Number(form.get("interval")) || null,
  }, task?.id), { progress: "Saving scheduled task…", success: "Scheduled task saved" }, (id) => router.push(`/tasks/${id}`))}>
    <div><label htmlFor="task-title">Title</label><input id="task-title" name="title" required maxLength={120} defaultValue={task?.title} className={field} /></div>
    <div><label htmlFor="task-prompt">Instructions</label><textarea id="task-prompt" name="prompt" required maxLength={8000} rows={6} defaultValue={task?.prompt} className={field} /></div>
    <div><label htmlFor="task-time">Next run (UTC)</label><input id="task-time" aria-describedby="task-time-hint" name="runAt" type="datetime-local" required defaultValue={task?.nextRunAt.slice(0, 16)} className={field} /><p id="task-time-hint" className="mt-2 type-body-small text-on-surface-variant">Enter UTC time. Recurring tasks repeat at a fixed elapsed interval.</p></div>
    <div><label htmlFor="task-repeat">Repeat</label><select id="task-repeat" name="interval" defaultValue={task?.intervalMinutes ?? 0} className={field}><option value="0">Once</option><option value="60">Every hour</option><option value="1440">Every 24 hours</option><option value="10080">Every 7 days</option></select></div>
    <details open={!!task && task.script !== "[]"}>
      <summary>MCP workflow script (optional)</summary>
      <p className="my-3 type-body-small">A JSON array of up to 20 sequential MCP tool calls, each with tool and arguments. The agent receives the outputs and completes the instructions. Ask the task agent to write this for you.</p>
      <label className="sr-only" htmlFor="task-script">MCP workflow script</label><textarea id="task-script" name="script" rows={8} maxLength={32000} defaultValue={task?.script ?? "[]"} spellCheck={false} className={`${field} font-mono`} />
    </details>
    <div className="flex gap-3"><Button variant="text" type="button" onClick={() => router.back()}>Cancel</Button><Button type="submit" disabled={pending}>Save scheduled task</Button></div>
  </form>;
}
