import { describe, expect, it } from "vitest";
import { cronFields, explainCron } from "@/lib/tasks/cron";
import { nextCronOccurrence } from "@/lib/tasks/definition";

const now = new Date("2026-11-08T00:00:00Z");
describe("cron explanations and visual editor patterns", () => {
  it.each(["*/15 9-17 * * MON-FRI", "0 9,17 * JAN,MAR *", "0 0 L * *", "0 0 * * 1#2", "0 0 * * 5L", "0 9 ? * MON", "H/10 * * * *", "@daily", "@weekends", "0 0 9 * * *"])("previews %s with the same parser used by execution", expression => {
    const preview = explainCron(expression, "Asia/Shanghai", now);
    expect(preview.description.length).toBeGreaterThan(5);
    expect(preview.next).toHaveLength(3);
    expect(preview.next[0]).toBe(nextCronOccurrence(expression, "Asia/Shanghai", now).toISOString());
  });
  it("describes weekday schedules and normalizes aliases", () => {
    expect(explainCron("0 9 * * 1-5", "UTC", now).description).toContain("09:00");
    expect(cronFields("@daily")).toEqual(["0", "0", "*", "*", "*"]);
  });
  it("rejects unsupported sub-minute schedules, invalid fields and time zones", () => {
    for (const expression of ["@secondly", "*/5 * * * * *", "60 * * * *", "0 0 31 2 *"]) expect(() => explainCron(expression, "UTC", now)).toThrow();
    expect(() => explainCron("* * * * *", "Invalid/Zone", now)).toThrow();
  });
});
