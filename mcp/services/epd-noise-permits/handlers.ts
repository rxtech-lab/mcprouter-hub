import { epdSpatialQuery } from "@/lib/mcp/epd-spatial";

export const constructionNoisePermits = epdSpatialQuery("epd_rcd_1664940858993_72368", ["PERMIT_NO", "PERMITTEE_NAME_ENG", "PERMITTEE_NAME_CHIN", "SITE_ADDRESS_ENG", "SITE_ADDRESS_CHIN", "DISTRICT_ENG", "DISTRICT_CHIN"], {"en": "SITE_ADDRESS_ENG", "tc": "SITE_ADDRESS_CHIN"});
