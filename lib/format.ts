const dateFormatter = new Intl.DateTimeFormat("en-HK", { dateStyle: "medium", timeZone: "Asia/Hong_Kong" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-HK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Hong_Kong" });
const numberFormatter = new Intl.NumberFormat("en-HK");

export function formatDate(value: Date | string | number | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

export function formatDateTime(value: Date | string | number | null | undefined) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatRelative(value: Date | string | number | null | undefined, now = Date.now()) {
  if (!value) return "Never";
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
