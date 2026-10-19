import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ResponseTransformer } from "@/lib/mcp/types";

type CenstatdBody = {
  header?: {
    status?: {
      name?: string;
      code?: number;
      description?: string;
      message?: string[];
    };
    title?: string;
  };
  dataSet?: Array<Record<string, unknown>>;
};

/**
 * Normalises Census and Statistics Department web-table JSON responses:
 * - Surfaces API-level validation errors returned with HTTP 200.
 * - Replaces empty string `""` in `DIRECTION`, `SHIPMENT_TYPE`, `CONTAINER_TYPE`
 *   and `CHL` with `"Total"` so `response.filter` can match total rows as well as breakdowns.
 * - Filters by `period` (exact match or year prefix, e.g. `"2025"` matches `"2025"` and `"202506"`).
 * - Orders rows newest-period-first so bounded results always return the latest figures.
 */
export const normalizeShippingTable: ResponseTransformer = (body, input) => {
  if (!body || typeof body !== "object") {
    throw new UpstreamError("upstream_parse", "C&SD API returned an empty or malformed response");
  }
  const parsed = body as CenstatdBody;
  const status = parsed.header?.status;
  if ((status?.code !== undefined && status.code !== 0) || status?.name === "Fail") {
    const detail =
      Array.isArray(status?.message) && status.message.length
        ? status.message.join("; ")
        : (status?.description ?? "C&SD query failed");
    throw new UpstreamError("upstream_parse", `C&SD API error: ${detail}`);
  }
  if (!Array.isArray(parsed.dataSet)) {
    throw new UpstreamError("upstream_parse", "C&SD response did not include a dataSet array");
  }

  const wantedPeriod = typeof input.period === "string" ? input.period.trim() : "";
  const dataSet = parsed.dataSet
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .filter((row) => {
      if (!wantedPeriod) return true;
      const period = String(row.period ?? "");
      return period === wantedPeriod || period.startsWith(wantedPeriod);
    })
    .map((row): Record<string, unknown> => ({
      ...row,
      ...("DIRECTION" in row ? { DIRECTION: row.DIRECTION || "Total" } : {}),
      ...("SHIPMENT_TYPE" in row ? { SHIPMENT_TYPE: row.SHIPMENT_TYPE || "Total" } : {}),
      ...("CONTAINER_TYPE" in row ? { CONTAINER_TYPE: row.CONTAINER_TYPE || "Total" } : {}),
      ...("CHL" in row ? { CHL: row.CHL || "Total" } : {}),
    }))
    .sort((a, b) => String(b.period ?? "").localeCompare(String(a.period ?? "")));

  return { ...parsed, dataSet };
};
