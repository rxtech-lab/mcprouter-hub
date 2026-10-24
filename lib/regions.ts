import { REGIONS, type RegionId } from "@/mcp/regions";
import { msg } from "@/lib/i18n/translate";

export { REGIONS, type RegionId };

/** Region names, translated where they are shown: `t(REGION_NAMES[id])`. */
export const REGION_NAMES: Record<RegionId, string> = { hk: msg("Hong Kong"), global: msg("Global") };
