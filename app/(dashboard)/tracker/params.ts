import { z } from "zod";
import { listHref } from "@/app/sources/params";
import { TRACKER_STATUSES } from "@/lib/tracker";

function flatten(raw: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, (Array.isArray(value) ? value[0] : value) || undefined]));
}

const datasetParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(TRACKER_STATUSES).optional().catch(undefined),
  format: z.string().optional().catch(undefined),
  api: z.literal("1").optional().catch(undefined),
  provider: z.string().optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  dataset: z.string().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export type DatasetParams = z.infer<typeof datasetParamsSchema>;

export function parseDatasetParams(raw: Record<string, string | string[] | undefined>) {
  return datasetParamsSchema.parse(flatten(raw));
}

/** A datasets URL with the given filters; the page and open dataset reset unless passed. */
export function datasetsHref(params: Partial<Record<keyof DatasetParams, string | number | undefined>>) {
  return listHref("/tracker/datasets", params);
}

const groupParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export function parseGroupParams(raw: Record<string, string | string[] | undefined>) {
  return groupParamsSchema.parse(flatten(raw));
}
