import { epdSpatialQuery } from "@/lib/mcp/epd-spatial";

export const chemicalWasteCollectors = epdSpatialQuery("epd_rcd_1666161129768_2527", ["Collector_Name_Eng", "Collector_Name_Chin", "Address_Eng", "Address_Chin", "Waste_Type_Eng", "Waste_Type_Chin"], {"en": "Collector_Name_Eng", "tc": "Collector_Name_Chin"});
export const clinicalWasteCollectors = epdSpatialQuery("epd_rcd_1666160952535_97414", ["Collector_Name_Eng", "Collector_Name_Chin", "Address_Eng", "Address_Chin"], {"en": "Collector_Name_Eng", "tc": "Collector_Name_Chin"});
