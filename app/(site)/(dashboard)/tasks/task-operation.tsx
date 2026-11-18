"use client";

import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { NativeDialog } from "@/components/native-dialog";
import { Button } from "@/components/m3/button";
import { useActionRunner } from "@/components/use-action-runner";
import { changeScheduledTask, runScheduledTask } from "./actions";

export function TaskOperation({ id, operation, running = false }: { id: string; operation: "delete" | "enable" | "pause" | "run"; running?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const label = { delete: t("Delete"), enable: t("Enable"), pause: t("Pause"), run: t("Run now") }[operation];
  const close = () => router.push(`/tasks/${id}`);
  const description = operation === "run"
    ? running ? t("This task is already running. Follow its progress in run history.") : t("Run this task now using your MCP connections and plan allowance? Its schedule and paused state will stay unchanged. You can follow the run and open its result in run history.")
    : operation === "delete" ? t("Delete this schedule and its run history? Saved chats are kept.")
    : operation === "enable" ? t("Allow this task to run using your MCP connections and plan allowance? Past recurring times are skipped; a past one-time task is scheduled for the next minute.")
    : t("Pause future runs of this task?");
  return <NativeDialog title={{ delete: t("Delete scheduled task"), enable: t("Enable scheduled task"), pause: t("Pause scheduled task"), run: t("Run scheduled task now") }[operation]} onClose={close}><p className="text-on-surface-variant">{description}</p><div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="text" disabled={pending} onClick={close}>{t("Cancel")}</Button>{operation === "run" && running ? <Button onClick={() => router.push(`/tasks/${id}?tab=history`)}>{t("View run history")}</Button> : <Button disabled={pending} variant={operation === "delete" ? "danger" : "filled"} onClick={() => {
    if (operation === "run") {
      run(() => runScheduledTask(id), { progress: t("Starting task…"), success: t("Task started. Follow progress in run history.") }, () => router.push(`/tasks/${id}?tab=history`));
    } else {
      run(() => changeScheduledTask(id, operation), { progress: { delete: t("Deleting task…"), enable: t("Enabling task…"), pause: t("Pausing task…") }[operation], success: { delete: t("Task deleted"), enable: t("Task enabled"), pause: t("Task paused") }[operation] }, () => router.push(operation === "delete" ? "/tasks" : `/tasks/${id}`));
    }
  }}>{label}</Button>}</div></NativeDialog>;
}
