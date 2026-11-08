"use client";

import { useT } from "@/lib/i18n/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/m3/button";
import { useActionRunner } from "@/components/use-action-runner";
import { CronEditor, CronPreview } from "./cron-editor";
import { saveScheduledTask } from "./actions";

type EditableTask = { id: string; title: string; prompt: string; script: string; cronExpression: string | null; timeZone: string; nextRunAt: string };
const field = "mt-2 block w-full rounded-md border border-outline bg-surface-container-lowest p-3";

export function TaskForm({ task }: { task?: EditableTask }) {
  const t = useT();
  const router = useRouter();
  const [schedule, setSchedule] = useState(task && !task.cronExpression ? "once" : "cron");
  const [cronExpression, setCronExpression] = useState(task?.cronExpression ?? "0 9 * * *");
  const [timeZone, setTimeZone] = useState(task?.timeZone ?? "UTC");
  const { run, pending } = useActionRunner();
  return <form className="flex max-w-3xl flex-col gap-6" action={(form) => run(() => saveScheduledTask({
    title: form.get("title"), prompt: form.get("prompt"), script: form.get("script"),
    cronExpression: schedule === "cron" ? form.get("cronExpression") : null,
    timeZone: schedule === "cron" ? form.get("timeZone") : "UTC",
    ...(schedule === "once" ? { runAt: `${String(form.get("runAt"))}:00Z` } : {}),
  }, task?.id), { progress: t("Saving scheduled task…"), success: t("Scheduled task saved") }, (id) => router.push(`/tasks/${id}`))}>
    <div><label htmlFor="task-title">{t("Title")}</label><input id="task-title" name="title" required maxLength={120} defaultValue={task?.title} className={field} /></div>
    <div><label htmlFor="task-prompt">{t("Instructions")}</label><textarea id="task-prompt" name="prompt" required maxLength={8000} rows={6} defaultValue={task?.prompt} className={field} /></div>
    <div><label htmlFor="task-schedule">{t("Schedule")}</label><select id="task-schedule" value={schedule} onChange={(event) => setSchedule(event.target.value)} className={field}><option value="cron">{t("Recurring (cron)")}</option><option value="once">{t("Once")}</option></select></div>
    {schedule === "cron" ? <>
      <div><label htmlFor="task-cron">{t("Cron expression")}</label><input id="task-cron" name="cronExpression" required maxLength={120} value={cronExpression} onChange={event => setCronExpression(event.target.value)} aria-describedby="task-cron-hint" className={`${field} font-mono`} /><div className="mt-3"><CronEditor expression={cronExpression} timeZone={timeZone} onChange={setCronExpression} /></div><CronPreview expression={cronExpression} timeZone={timeZone} /><p id="task-cron-hint" className="mt-2 type-body-small text-on-surface-variant">{t("Minute, hour, day of month, month, day of week. Supports lists, ranges, steps, named months/weekdays, L, #, ?, H and aliases such as @daily. Tasks are checked once a minute; missed runs are skipped.")}</p></div>
      <div><label htmlFor="task-timezone">{t("Time zone")}</label><input id="task-timezone" name="timeZone" required maxLength={100} value={timeZone} onChange={event => setTimeZone(event.target.value)} aria-describedby="task-timezone-hint" className={field} /><p id="task-timezone-hint" className="mt-2 type-body-small text-on-surface-variant">{t("IANA time zone, such as Asia/Shanghai or America/New_York. The next run is calculated automatically.")}</p></div>
    </> : <div><label htmlFor="task-time">{t("Next run (UTC)")}</label><input id="task-time" name="runAt" type="datetime-local" required defaultValue={task?.nextRunAt.slice(0, 16)} className={field} /></div>}
    <details open={!!task && task.script !== "[]"}>
      <summary>{t("MCP workflow script (optional)")}</summary>
      <p className="my-3 type-body-small">{t("A JSON array of up to 20 sequential MCP tool calls, each with tool and arguments. The agent receives the outputs and completes the instructions. Ask the task agent to write this for you.")}</p>
      <label className="sr-only" htmlFor="task-script">{t("MCP workflow script")}</label><textarea id="task-script" name="script" rows={8} maxLength={32000} defaultValue={task?.script ?? "[]"} spellCheck={false} className={`${field} font-mono`} />
    </details>
    <div className="flex gap-3"><Button variant="text" type="button" onClick={() => router.back()}>{t("Cancel")}</Button><Button type="submit" disabled={pending}>{t("Save scheduled task")}</Button></div>
  </form>;
}
