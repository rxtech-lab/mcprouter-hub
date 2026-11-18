import { requirePageUser } from "@/lib/auth";
import { listTasks } from "@/lib/tasks/store";
import { TaskSidebar } from "./task-sidebar";

export default async function TasksLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const tasks = await listTasks(user.id);
  return <div className="flex gap-8"><TaskSidebar tasks={tasks.map(({ id, title, enabled }) => ({ id, title, enabled }))} /><div className="min-w-0 flex-1">{children}</div></div>;
}
