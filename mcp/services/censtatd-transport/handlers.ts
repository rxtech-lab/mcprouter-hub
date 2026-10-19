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

const INDICATOR_LABELS: Record<string, { en: string; tc: string; sc: string }> = {
  AIR_CARGO_THROUGHPUT: {
    en: "Air cargo throughput",
    tc: "空運貨物吞吐量",
    sc: "空运货物吞吐量",
  },
  HKPOST_LETTER_M: {
    en: "Hongkong Post processed letter mail",
    tc: "香港郵政處理的信件郵件",
    sc: "香港邮政处理的信件邮件",
  },
  HKPOST_PARCELS: {
    en: "Hongkong Post processed parcels",
    tc: "香港郵政處理的包裹",
    sc: "香港邮政处理的包裹",
  },
  SCHFLIGHT_AIRLINE: {
    en: "Airline companies operating scheduled international flights",
    tc: "在年內營運國際定期航班的航空公司",
    sc: "在年内营运国际定期航班的航空公司",
  },
  "AIR_FIGHT_MT-SCH": {
    en: "Scheduled international flights",
    tc: "定期國際航班",
    sc: "定期国际航班",
  },
  "AIR_FIGHT_MT-NONSCH": {
    en: "Non-scheduled international flights",
    tc: "不定期國際航班",
    sc: "不定期国际航班",
  },
  IN_SCHPASS_FLIGHT: {
    en: "Incoming scheduled passenger flights per week",
    tc: "來港的定期載客航班（以每星期計）",
    sc: "来港的定期载客航班（以每星期计）",
  },
  AIR_SEAT_CAP: {
    en: "Total seat capacity per week",
    tc: "機位總數（以每星期計）",
    sc: "机位总数（以每星期计）",
  },
  SHIP_COM: {
    en: "Shipping companies listed to employ HK registered seafarers",
    tc: "在商船海員管理處登記僱用本港註冊海員的船公司",
    sc: "在商船海员管理处登记雇用本港注册海员的船公司",
  },
  HK_SEAFARER: {
    en: "Registered Hong Kong seafarers",
    tc: "根據《商船（海員）條例》註冊的本港海員",
    sc: "根据《商船（海员）条例》注册的本港海员",
  },
  HK_SEAFARER_AGREE: {
    en: "Employment agreements of HK registered seafarers",
    tc: "年內本港註冊海員的僱用協議",
    sc: "年内本港注册海员的雇用协议",
  },
  AIRPORT_ARRIVAL_TRANSIT: {
    en: "Arrival transits via Hong Kong Airport",
    tc: "經香港機場來港過境人次",
    sc: "经香港机场来港过境人次",
  },
};

function normalizeDirection(value: unknown): string {
  if (value === "" || value === null || value === undefined) return "Total";
  if (value === 1 || value === "1") return "Discharged";
  if (value === 2 || value === "2") return "Loaded";
  return String(value);
}

/**
 * Normalises Census and Statistics Department transport, aviation, postal and
 * seafarers web-table JSON responses:
 * - Surfaces API-level validation errors returned with HTTP 200.
 * - Normalises empty `REGION` to `"Total"`, and `DIRECTION` (`""`, `1`, `2`) to
 *   `"Total"`, `"Discharged"` and `"Loaded"`.
 * - Adds a localised `indicatorDesc` from the C&SD `sv` code (`svDesc` only holds the unit).
 * - Filters by `period` (exact match or year prefix) and sorts newest-period-first.
 */
export const normalizeTransportTable: ResponseTransformer = (body, input) => {
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
  const lang = input.lang === "tc" || input.lang === "sc" ? input.lang : "en";

  const dataSet = parsed.dataSet
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .filter((row) => {
      if (!wantedPeriod) return true;
      const period = String(row.period ?? "");
      return period === wantedPeriod || period.startsWith(wantedPeriod);
    })
    .map((row): Record<string, unknown> => {
      const sv = typeof row.sv === "string" ? row.sv : "";
      const indicatorDesc = INDICATOR_LABELS[sv]?.[lang];
      return {
        ...row,
        ...("REGION" in row ? { REGION: row.REGION || "Total" } : {}),
        ...("DIRECTION" in row ? { DIRECTION: normalizeDirection(row.DIRECTION) } : {}),
        ...(indicatorDesc ? { indicatorDesc } : {}),
      };
    })
    .sort((a, b) => String(b.period ?? "").localeCompare(String(a.period ?? "")));

  return { ...parsed, dataSet };
};
