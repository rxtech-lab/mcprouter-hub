import { z } from "zod";
import { API_CATEGORIES, API_STATUSES, type ApiCategory, type ApiStatus } from "@/lib/apis";

const apiParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(Object.keys(API_STATUSES) as [ApiStatus, ...ApiStatus[]]).optional().catch(undefined),
  category: z.enum(Object.keys(API_CATEGORIES) as [ApiCategory, ...ApiCategory[]]).optional().catch(undefined),
  /** Opens that API's details dialog. */
  api: z.string().max(20).optional().catch(undefined),
});

export type ApiParams = z.infer<typeof apiParamsSchema>;

export function parseApiParams(raw: Record<string, string | string[] | undefined>) {
  return apiParamsSchema.parse(Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, (Array.isArray(value) ? value[0] : value) || undefined])));
}
