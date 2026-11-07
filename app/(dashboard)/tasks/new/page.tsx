import { getT } from "@/lib/i18n/server";
import { requirePageUser } from "@/lib/auth";
import { TaskForm } from "../task-form";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("New scheduled task") };
}
export default async function NewTaskPage() {
  const t = await getT();
  await requirePageUser();
  return <div className="space-y-6 animate-pane-in"><h1 className="type-headline-large">{t("New scheduled task")}</h1><TaskForm /></div>;
}
