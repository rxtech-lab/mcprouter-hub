import { z } from "zod";

export const RANGES = [7, 14, 30];

export const daysSchema = z.enum(["7", "14", "30"]).catch("30").transform(Number);

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function clientHref(client: string, days: number) {
  return `/usage/clients/${encodeURIComponent(client)}?days=${days}`;
}
