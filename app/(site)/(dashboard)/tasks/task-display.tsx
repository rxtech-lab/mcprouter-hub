import { getT } from "@/lib/i18n/server";
import { INTL_LOCALES } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n/translate";
import { CheckCircle2, CirclePause, LoaderCircle } from "lucide-react";

export async function TaskStatus({ enabled, running = false }: { enabled: boolean; running?: boolean }) {
  const t = await getT();
  const Icon = running ? LoaderCircle : enabled ? CheckCircle2 : CirclePause;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 type-label-medium ${running ? "bg-tertiary-container text-on-tertiary-container" : enabled ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-high text-on-surface-variant"}`}><Icon size={14} className={running ? "animate-spin motion-reduce:animate-none" : ""} />{running ? t("Running") : enabled ? t("Scheduled") : t("Paused")}</span>;
}

export async function TaskTime({ date, timeZone }: { date: Date; timeZone: string }) {
  const t = await getT();
  return <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat(INTL_LOCALES[t.locale], { timeZone, month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)}</time>;
}

export function runDuration(start: Date, finish: Date | null, t: Translator) {
  if (!finish) return t("In progress");
  const seconds = Math.max(0, Math.round((finish.getTime() - start.getTime()) / 1000));
  return seconds < 60 ? t("{seconds}s", { seconds }) : t("{minutes}m {seconds}s", { minutes: Math.floor(seconds / 60), seconds: seconds % 60 });
}

export function runStatus(status: "running" | "succeeded" | "failed", t: Translator) {
  return { running: t("Running"), succeeded: t("Succeeded"), failed: t("Failed") }[status];
}
