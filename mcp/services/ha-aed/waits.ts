// Parsing Hospital Authority waiting times, shared by the app and the chat card.

/** "19 minutes", "1.5 hours", "less than 15 minutes", "over 8 hours", "19分鐘", "1.5小時" → minutes. */
export function toMinutes(text: unknown): number | null {
  if (!text) return null;
  const value = parseFloat(String(text).replace(/[^\d.]/g, " ").trim().split(/\s+/)[0]);
  if (!isFinite(value)) return null;
  return /hour|小時|小时/i.test(String(text)) ? value * 60 : value;
}
