import { Bus, BusFront, CalendarDays, CloudSun, Database, Hospital, SquareParking, TrainFront } from "lucide-react";

const icons = {
  citybus: Bus,
  "datagovhk-catalog": Database,
  "ha-aed": Hospital,
  "hk-holidays": CalendarDays,
  "hko-weather": CloudSun,
  kmb: BusFront,
  mtr: TrainFront,
  "td-carpark": SquareParking,
} as const;

// Container roles cycle so a grid of services reads as a set without one colour dominating.
const tones = [
  "bg-primary-container text-on-primary-container",
  "bg-secondary-container text-on-secondary-container",
  "bg-tertiary-container text-on-tertiary-container",
];

/** `onContainer` is for icons placed on a coloured container, where the tonal fills would blend in. */
export function ServiceIcon({ id, index = 0, size = "md", onContainer = false }: { id: string; index?: number; size?: "md" | "lg"; onContainer?: boolean }) {
  const Icon = icons[id as keyof typeof icons] ?? Database;
  return (
    <span className={`flex shrink-0 items-center justify-center ${size === "lg" ? "size-16 rounded-xl" : "size-12 rounded-lg"} ${onContainer ? "bg-surface-container-lowest/60" : tones[index % tones.length]}`}>
      <Icon size={size === "lg" ? 32 : 24} />
    </span>
  );
}
