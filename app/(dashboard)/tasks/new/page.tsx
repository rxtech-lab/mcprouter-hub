import { requirePageUser } from "@/lib/auth";
import { TaskForm } from "../task-form";

export const metadata = { title: "New scheduled task" };
export default async function NewTaskPage() {
  await requirePageUser();
  return <div className="space-y-6 animate-pane-in"><h1 className="type-headline-large">New scheduled task</h1><TaskForm /></div>;
}
