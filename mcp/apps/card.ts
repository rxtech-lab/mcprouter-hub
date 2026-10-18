/**
 * Chat cards: a still picture of a tool result, for channels that can't run an
 * MCP App (Telegram, WhatsApp). A service's `card.ts` turns a result into a
 * `Card`, and `lib/cards/render.ts` draws it as an SVG and a PNG. Unlike
 * `runtime.ts` this runs on the server, so it never touches the DOM.
 */

/** Upstream JSON. Each API has its own shape, so cards read fields defensively. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;

export type Lang = "en" | "tc" | "sc";

export type Tone = "accent" | "info" | "success" | "warning" | "danger" | "neutral";

export type Chip = { text: string; tone?: Tone };

export type CardRow = { leading?: Chip; title: string; subtitle?: string | null; trailing?: Chip[]; muted?: boolean };

export type CardBlock =
  | { kind: "hero"; value: string; label?: string | null; detail?: string | null; tone?: Tone }
  | { kind: "notice"; text: string; tone: Exclude<Tone, "accent" | "neutral"> }
  | { kind: "stats"; items: Array<{ label: string; value: string }> }
  | { kind: "text"; text: string; muted?: boolean }
  | { kind: "chips"; items: Chip[] }
  | { kind: "section"; title: string }
  | ({ kind: "row" } & CardRow);

export type Card = {
  accent: string;
  onAccent?: string;
  badge: string;
  title: string;
  subtitle?: string | null;
  blocks: CardBlock[];
  footer?: string | null;
};

/** What a card builder gets: the same `{ tool, input, data, meta }` an app's view has. */
export type CardInput = { tool: string; input: Row; data: Row; meta: { total?: number; returned?: number; truncated?: boolean } };

export type CardBuilder = (result: CardInput) => Card | null;

// ---------------------------------------------------------------- blocks

export const card = {
  hero: (value: string, label?: string | null, detail?: string | null, tone?: Tone): CardBlock => ({ kind: "hero", value, label, detail, tone }),
  notice: (text: string, tone: Exclude<Tone, "accent" | "neutral"> = "info"): CardBlock => ({ kind: "notice", text, tone }),
  stats: (items: Array<{ label: string; value: string } | null | false>): CardBlock => ({ kind: "stats", items: items.filter((item): item is { label: string; value: string } => Boolean(item)) }),
  text: (text: string, muted = false): CardBlock => ({ kind: "text", text, muted }),
  chips: (items: Chip[]): CardBlock => ({ kind: "chips", items }),
  section: (title: string): CardBlock => ({ kind: "section", title }),
  row: (row: CardRow): CardBlock => ({ kind: "row", ...row }),
  /** Arrival times as chips; the first is highlighted. */
  etas: (labels: string[]): Chip[] => labels.filter(Boolean).slice(0, 3).map((text, index) => ({ text, tone: index === 0 ? "accent" : "neutral" })),
};

/** Drops the falsy entries of a block list, so builders can write `cond ? block : null`. */
export function blocks(...items: Array<CardBlock | CardBlock[] | null | undefined | false | "">): CardBlock[] {
  return items.flat().filter((item): item is CardBlock => Boolean(item));
}

/** "Showing 100 of 412" when the tool truncated its result. */
export function truncation(result: CardInput, extra?: string | null) {
  const parts = [extra, result.meta.truncated ? `Showing ${result.meta.returned} of ${result.meta.total}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// ---------------------------------------------------------------- format

const TIME_ZONE = "Asia/Hong_Kong";

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "string" || !value) return null;
  // "2026-10-18 08:34:10" (MTR, car parks) is Hong Kong local time.
  const normalised = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value) ? `${value.replace(" ", "T")}+08:00` : value;
  const date = new Date(normalised);
  return isNaN(date.getTime()) ? null : date;
}

export const fmt = {
  date: toDate,
  /** 08:41, in Hong Kong time. */
  time(value: unknown) {
    const date = toDate(value);
    return date ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(date) : "";
  },
  /** Sun 18 Oct */
  day(value: unknown, options?: Intl.DateTimeFormatOptions) {
    const date = toDate(value);
    return date ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE, ...options }).format(date) : "";
  },
  dateTime(value: unknown) {
    const date = toDate(value);
    return date ? `${fmt.day(date)}, ${fmt.time(date)}` : "";
  },
  /** "Arriving", "3 min", or "" when the time has passed or is missing. */
  eta(value: unknown, now = Date.now()) {
    const date = toDate(value);
    if (!date) return "";
    const minutes = Math.round((date.getTime() - now) / 60_000);
    if (minutes < -1) return "";
    return minutes <= 0 ? "Arriving" : `${minutes} min`;
  },
  ago(value: unknown, now = Date.now()) {
    const date = toDate(value);
    if (!date) return "";
    const minutes = Math.round((now - date.getTime()) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours} h ago` : fmt.day(date);
  },
  /** A localised field: pick(stop, "name", lang) reads name_en, name_tc or name_sc. */
  pick(item: Row, base: string, lang: Lang = "en"): string {
    if (!item) return "";
    return item[`${base}_${lang}`] || item[`${base}_en`] || item[`${base}_tc`] || item[base] || "";
  },
  /** Upstream names are often SHOUTED; soften them for display. */
  title(text: string) {
    if (typeof text !== "string" || text !== text.toUpperCase() || !/[A-Z]{3}/.test(text)) return text;
    return text.toLowerCase().replace(/(^|[\s(\-/])([a-z])/g, (_, space: string, letter: string) => space + letter.toUpperCase());
  },
  plural(count: number, word: string) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
  },
};

/** The language a result is in: the tool's `lang` input, else English. */
export function langOf(input: Row): Lang {
  return input?.lang === "tc" || input?.lang === "sc" ? input.lang : "en";
}

export function asList(value: unknown): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean).map(String);
}
