import { z } from "zod";

export const listParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  api: z.literal("1").optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export function parseListParams(raw: Record<string, string | string[] | undefined>) {
  return listParamsSchema.parse(Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, (Array.isArray(value) ? value[0] : value) || undefined])));
}

/** A list URL with the current filters, minus empty values. */
export function listHref(path: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "" && !(key === "page" && value === 1)) query.set(key, String(value));
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}
