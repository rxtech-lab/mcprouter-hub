import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getTask, runsFor } from "@/lib/tasks/store";
import { TaskForm } from "../task-form";
import { TaskOperation } from "../task-operation";

export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const query = await searchParams;
  const task = await getTask(user.id, id).catch((error) => { if (error instanceof Error && error.message === "NOT_FOUND") notFound(); throw error; });
  if (query.edit === "1") return <div className="space-y-6"><h1 className="type-headline-large">Edit scheduled task</h1><TaskForm task={{ ...task, nextRunAt: task.nextRunAt.toISOString() }} /></div>;
  const runs = await runsFor(user.id, id);
  const operation = ["delete", "pause", "enable"].includes(query.action ?? "") ? query.action as "delete" | "pause" | "enable" : undefined;
  return <div className="space-y-6 animate-pane-in"><Link href="/tasks" className="text-primary">← Scheduled tasks</Link><header><h1 className="type-headline-large">{task.title}</h1><p className="mt-2 text-on-surface-variant">{task.enabled ? "Scheduled" : "Paused — review and enable to run"} · {task.nextRunAt.toISOString()} · {task.intervalMinutes ? `Every ${task.intervalMinutes / 60} hours` : "Once"}</p></header>
    <nav className="flex flex-wrap gap-6 text-primary"><Link href={`/tasks/${id}?edit=1`}>Edit</Link><Link href={`/tasks/${id}?action=${task.enabled ? "pause" : "enable"}`}>{task.enabled ? "Pause" : "Enable"}</Link><Link href={`/tasks/${id}?action=delete`}>Delete</Link></nav>
    <section><h2 className="type-title-large mb-3">Instructions</h2><p className="whitespace-pre-wrap">{task.prompt}</p></section>
    {task.script !== "[]" && <details><summary>MCP workflow script</summary><pre className="mt-3 overflow-x-auto rounded-md bg-surface-container p-4">{task.script}</pre></details>}
    <section><h2 className="type-title-large mb-3">Recent runs</h2><ul className="divide-y divide-outline-variant">{runs.map((run) => <li className="flex flex-wrap justify-between gap-3 py-4" key={run.id}><div><p>{run.status} · {run.createdAt.toISOString()}</p>{run.error && <p className="text-error">{run.error}</p>}</div>{run.chatId && <Link className="text-primary" href={`/chat/${run.chatId}`}>Open result</Link>}</li>)}</ul>{!runs.length && <p>No runs yet.</p>}</section>
    {operation && <TaskOperation id={id} operation={operation} />}
  </div>;
}
