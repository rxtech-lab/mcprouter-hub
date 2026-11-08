"use client";

import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function TaskSidebar({ tasks }: { tasks: { id: string; title: string; enabled: boolean }[] }) {
  const t = useT();
  const pathname = usePathname();
  if (pathname === "/tasks") return null;
  return <aside className="hidden w-56 shrink-0 lg:block"><nav aria-label={t("Your scheduled tasks")} className="sticky top-6 space-y-4"><Link href="/tasks" className="type-title-medium text-primary">{t("Scheduled tasks")}</Link><ul className="max-h-[65dvh] space-y-1 overflow-y-auto">{tasks.map((task) => <li key={task.id}><Link href={`/tasks/${task.id}`} aria-current={pathname === `/tasks/${task.id}` ? "page" : undefined} className="block rounded-lg px-3 py-3 transition-colors hover:bg-surface-container aria-[current=page]:bg-secondary-container"><span className="block truncate type-label-large">{task.title}</span><span className="type-body-small text-on-surface-variant">{task.enabled ? t("Scheduled") : t("Paused")}</span></Link></li>)}</ul><Link href="/chat" className="block text-primary">{t("Agent") + " →"}</Link></nav></aside>;
}
