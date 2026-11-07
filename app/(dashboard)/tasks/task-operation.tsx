"use client";

import { useRouter } from "next/navigation";
import { NativeDialog } from "@/components/native-dialog";
import { Button } from "@/components/m3/button";
import { useActionRunner } from "@/components/use-action-runner";
import { changeScheduledTask } from "./actions";

export function TaskOperation({ id, operation }: { id: string; operation: "delete" | "enable" | "pause" }) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const label = { delete: "Delete", enable: "Enable", pause: "Pause" }[operation];
  const close = () => router.push(`/tasks/${id}`);
  return <NativeDialog title={`${label} scheduled task`} onClose={close}><p>{operation === "delete" ? "Delete this schedule and its run history? Saved chats are kept." : operation === "enable" ? "Allow this task to run using your MCP connections and plan allowance? If its run time has passed, it will run in the next minute." : "Pause future runs of this task?"}</p><div className="mt-6 flex justify-end gap-3"><Button variant="text" onClick={close}>Cancel</Button><Button disabled={pending} variant={operation === "delete" ? "danger" : "filled"} onClick={() => run(() => changeScheduledTask(id, operation), { progress: `${label} task…`, success: `Task ${operation === "delete" ? "deleted" : operation === "enable" ? "enabled" : "paused"}` }, () => router.push(operation === "delete" ? "/tasks" : `/tasks/${id}`))}>{label}</Button></div></NativeDialog>;
}
