import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";

const aliases: Record<string, string> = {
  "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *", "@weekly": "0 0 * * 0", "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@hourly": "0 * * * *", "@minutely": "* * * * *", "@weekdays": "0 0 * * 1-5", "@weekends": "0 0 * * 0,6",
};

export function cronFields(expression: string) {
  const value = aliases[expression.trim().toLowerCase()] ?? expression.trim();
  const fields = value.split(/\s+/);
  // The dispatcher runs once a minute; never promise sub-minute execution.
  if (fields.length === 6 && fields[0] === "0") fields.shift();
  if (fields.length !== 5) throw new Error("Use five cron fields. Seconds are only supported when set to 0; tasks are checked once a minute.");
  return fields;
}

export function parseTaskCron(expression: string, timeZone: string, now: Date) {
  return CronExpressionParser.parse(cronFields(expression).join(" "), { currentDate: now, tz: timeZone, hashSeed: expression.trim() });
}

export function explainCron(expression: string, timeZone: string, now: Date) {
  const parsed = parseTaskCron(expression, timeZone, now);
  const description = cronstrue.toString(parsed.stringify(), { use24HourTimeFormat: true, verbose: true });
  return { description, next: parsed.take(3).map(date => date.toDate().toISOString()) };
}
