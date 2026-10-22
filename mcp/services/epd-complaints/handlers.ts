import { epdSpatialQuery } from "@/lib/mcp/epd-spatial";

export const pollutionComplaintStatistics = epdSpatialQuery("epd_rcd_1629267205235_67879", ["DistrictEN", "DistrictTC", "YearEN"], {"en": "DistrictEN", "tc": "DistrictTC"});
