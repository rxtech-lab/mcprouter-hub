import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { ArrowRight, CalendarClock, Clock3, Plus, Sparkles } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { listTasks } from "@/lib/tasks/store";
import { buttonClasses } from "@/components/m3/button";
import { TaskStatus, TaskTime } from "./task-display";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Scheduled tasks") };
}
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const t = await getT();
  const user = await requirePageUser();
  const [tasks, query] = await Promise.all([listTasks(user.id), searchParams]);
  const filter = query.status === "scheduled" || query.status === "paused" ? query.status : "all";
  const visible = tasks.filter(task => filter === "all" || task.enabled === (filter === "scheduled"));
  const active = tasks.filter(task => task.enabled).length;
  return <div className="space-y-8 animate-pane-in">
    <header className="flex flex-wrap items-start justify-between gap-5"><div><p className="type-label-large text-primary mb-2">{t("AUTOMATIONS")}</p><h1 className="type-headline-large">{t("Scheduled tasks")}</h1><p className="mt-3 max-w-xl text-on-surface-variant">{t("Give your agent a routine. Run instructions and MCP workflows on a schedule, or whenever you need them.")}</p></div><Link href="/tasks/new" className={buttonClasses()}><Plus size={18} />{t("New task")}</Link></header>
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface-container-low px-5 py-4"><div className="flex items-center gap-3"><CalendarClock size={24} className="text-primary" /><p className="type-body-medium"><strong>{t("{count} scheduled", { count: active })}</strong> <span className="mx-2 text-outline">/</span> {t("{count} paused", { count: tasks.length - active })}</p></div><Link href="/chat" className="inline-flex items-center gap-2 type-label-large text-primary"><Sparkles size={17} />{t("Build with the agent")}<ArrowRight size={16} /></Link></div>
    <section aria-label={t("Task schedules")}><nav aria-label={t("Filter tasks")} className="mb-5 flex gap-2">{([['all', t("All tasks")], ['scheduled', t("Scheduled")], ['paused', t("Paused")]] as const).map(([value, label]) => <Link key={value} href={value === "all" ? "/tasks" : `/tasks?status=${value}`} aria-current={filter === value ? "page" : undefined} className="rounded-full px-4 py-2 type-label-large transition-colors duration-200 hover:bg-surface-container-high aria-[current=page]:bg-secondary-container aria-[current=page]:text-on-secondary-container">{label}</Link>)}</nav>
      <ul className="space-y-3">{visible.map(task => <li key={task.id}><Link href={`/tasks/${task.id}`} className="group flex flex-wrap items-center gap-4 rounded-xl border border-outline-variant p-5 transition-[background-color,box-shadow] duration-200 ease-emphasized hover:bg-surface-container-low hover:shadow-elevation-1 focus-visible:outline-2 focus-visible:outline-primary"><span className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary sm:flex"><CalendarClock size={23} /></span><div className="min-w-0 flex-1 basis-48"><h2 className="type-title-medium break-words">{task.title}</h2><p className="mt-1 type-body-small text-on-surface-variant">{task.cronExpression ? `${task.cronExpression} (${task.timeZone})` : t("One-time task")}</p></div><div className="min-w-0 sm:text-right"><TaskStatus enabled={task.enabled} running={!!task.leaseUntil && task.leaseUntil > new Date()} /><p className="mt-2 flex items-center gap-1.5 type-body-small text-on-surface-variant"><Clock3 size={14} />{task.enabled ? <>{t("Next run")} <TaskTime date={task.nextRunAt} timeZone={task.timeZone} /></> : t("No upcoming run")}</p></div><ArrowRight size={18} className="text-on-surface-variant transition-transform duration-200 group-hover:translate-x-1" /></Link></li>)}</ul>
      {!visible.length && <div className="rounded-xl border border-dashed border-outline-variant px-6 py-16 text-center"><CalendarClock size={36} className="mx-auto mb-4 text-primary" /><h2 className="type-title-large">{tasks.length ? t("No tasks in this view") : t("Your next routine starts here")}</h2><p className="mx-auto mb-6 mt-2 max-w-md text-on-surface-variant">{tasks.length ? t("Choose another filter to see your tasks.") : t("Create a schedule for a daily briefing, a recurring check, or an MCP workflow. Results are saved to chat.")}</p><Link href={tasks.length ? "/tasks" : "/tasks/new"} className={buttonClasses("tonal")}>{tasks.length ? t("View all tasks") : t("Create your first task")}</Link></div>}
    </section>
  </div>;
}
