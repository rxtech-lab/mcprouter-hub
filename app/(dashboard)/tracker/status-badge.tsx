import { CircleCheck, CircleDashed, CircleDot, CircleSlash, Clock } from "lucide-react";
import { Badge } from "@/components/m3/chip";
import { STATUS_LABELS, type TrackerStatus } from "@/lib/tracker";

export const STATUS_STYLE: Record<TrackerStatus, { tone: "success" | "primary" | "tertiary" | "error" | "neutral"; icon: (size: number) => React.ReactNode }> = {
  converted: { tone: "success", icon: (size) => <CircleCheck size={size} /> },
  in_progress: { tone: "primary", icon: (size) => <CircleDot size={size} /> },
  planned: { tone: "tertiary", icon: (size) => <Clock size={size} /> },
  skipped: { tone: "error", icon: (size) => <CircleSlash size={size} /> },
  not_started: { tone: "neutral", icon: (size) => <CircleDashed size={size} /> },
};

export function StatusBadge({ status }: { status: TrackerStatus }) {
  const style = STATUS_STYLE[status];
  return <Badge tone={style.tone} icon={style.icon(14)}>{STATUS_LABELS[status]}</Badge>;
}
