import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { listTasks } from "@/lib/tasks/store";

export const metadata = { title: "Scheduled tasks" };
export default async function TasksPage() {
  const user = await requirePageUser();
  const tasks = await listTasks(user.id);
  return <div className="space-y-6 animate-pane-in"><header className="flex flex-wrap items-center justify-between gap-4"><h1 className="type-headline-large">Scheduled tasks</h1><Link href="/tasks/new" className="rounded-full bg-primary px-6 py-3 text-on-primary">New task</Link></header>
    <p>Run instructions and MCP workflows on a schedule. Results are saved in your chat history.</p><Link className="inline-block text-primary" href="/taskagent">Ask the task agent to write a script →</Link>
    <ul className="divide-y divide-outline-variant">{tasks.map((task) => <li key={task.id}><Link href={`/tasks/${task.id}`} className="flex items-center justify-between gap-4 py-5"><div><h2 className="type-title-medium">{task.title}</h2><p className="type-body-small text-on-surface-variant">{task.intervalMinutes ? `Every ${task.intervalMinutes / 60} hours` : "Once"} · {task.nextRunAt.toISOString().replace("T", " ").slice(0, 16)} UTC</p></div><span>{task.enabled ? "Scheduled" : "Paused"}</span></Link></li>)}</ul>
    {!tasks.length && <p>No scheduled tasks yet. Create one here or ask the agent in chat.</p>}
  </div>;
}
