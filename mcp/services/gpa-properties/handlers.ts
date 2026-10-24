import { developmentRequest, developmentResponse } from "@/lib/mcp/development-spatial";

const contract1961 = {
  "oid": "OBJECTID",
  "names": {
    "en": "en_address",
    "tc": "tc_address",
    "sc": "sc_address"
  },
  "search": [
    "en_address",
    "tc_address",
    "sc_address",
    "en_remarks",
    "tc_remarks",
    "sc_remarks"
  ],
  "fields": {
    "en_address": "esriFieldTypeString",
    "en_remarks": "esriFieldTypeString",
    "sc_address": "esriFieldTypeString",
    "sc_remarks": "esriFieldTypeString",
    "tc_address": "esriFieldTypeString",
    "tc_remarks": "esriFieldTypeString",
    "OBJECTID": "esriFieldTypeOID"
  },
  "geometry": "esriGeometryPoint",
  "label": "Domestic properties for sale"
};

export const request1961 = developmentRequest(contract1961);

export const response1961 = developmentResponse(contract1961);

const contract1962 = {
  "oid": "OBJECTID_1",
  "names": {
    "en": "BLDG_ENGNM",
    "tc": "BLDG_CHTNM"
  },
  "search": [
    "BLDG_ENGNM",
    "BLDG_CHTNM",
    "ADDRESS_EN",
    "ADDRESS_TC"
  ],
  "fields": {
    "OBJECTID": "esriFieldTypeString",
    "ADDRESS_EN": "esriFieldTypeString",
    "ADDRESS_TC": "esriFieldTypeString",
    "BLDG_ENGNM": "esriFieldTypeString",
    "BLDG_CHTNM": "esriFieldTypeString",
    "OS_TYPE_EN": "esriFieldTypeString",
    "OS_TYPE_TC": "esriFieldTypeString",
    "OS_STATUS_EN": "esriFieldTypeString",
    "OS_STATUS_TC": "esriFieldTypeString",
    "BEACH_EN": "esriFieldTypeString",
    "BEACH_TC": "esriFieldTypeString",
    "AMENITY_AREA_EN": "esriFieldTypeString",
    "AMENITY_AREA_TC": "esriFieldTypeString",
    "INDOOR_FACILITIES_EN": "esriFieldTypeString",
    "INDOOR_FACILITIES_TC": "esriFieldTypeString",
    "COMPLETION_YEAR_EN": "esriFieldTypeString",
    "COMPLETION_YEAR_TC": "esriFieldTypeString",
    "OS_AREA_EN__sq_metre_": "esriFieldTypeString",
    "OS_AREA_TC__sq_metre_": "esriFieldTypeString",
    "LAST_UPDATE": "esriFieldTypeString",
    "OBJECTID_1": "esriFieldTypeOID"
  },
  "geometry": "esriGeometryPoint",
  "label": "Government office public open spaces"
};

export const request1962 = developmentRequest(contract1962);

export const response1962 = developmentResponse(contract1962);

const contract1963 = {
  "oid": "OBJECTID",
  "names": {
    "en": "en_name",
    "tc": "tc_name",
    "sc": "sc_name"
  },
  "search": [
    "en_name",
    "tc_name",
    "sc_name",
    "en_address",
    "tc_address",
    "sc_address",
    "en_district",
    "tc_district",
    "sc_district"
  ],
  "fields": {
    "en_name": "esriFieldTypeString",
    "tc_name": "esriFieldTypeString",
    "sc_name": "esriFieldTypeString",
    "en_address": "esriFieldTypeString",
    "tc_address": "esriFieldTypeString",
    "sc_address": "esriFieldTypeString",
    "en_district": "esriFieldTypeString",
    "tc_district": "esriFieldTypeString",
    "sc_district": "esriFieldTypeString",
    "en_photo": "esriFieldTypeString",
    "tc_photo": "esriFieldTypeString",
    "sc_photo": "esriFieldTypeString",
    "en_ava_area_remarks": "esriFieldTypeString",
    "tc_ava_area_remarks": "esriFieldTypeString",
    "sc_ava_area_remarks": "esriFieldTypeString",
    "en_declared_monument_grading_historic_building": "esriFieldTypeString",
    "tc_declared_monument_grading_historic_building": "esriFieldTypeString",
    "sc_declared_monument_grading_historic_building": "esriFieldTypeString",
    "en_lift": "esriFieldTypeString",
    "tc_lift": "esriFieldTypeString",
    "sc_lift": "esriFieldTypeString",
    "en_managing_dept": "esriFieldTypeString",
    "tc_managing_dept": "esriFieldTypeString",
    "sc_managing_dept": "esriFieldTypeString",
    "contact_number": "esriFieldTypeString",
    "en_ava_area": "esriFieldTypeString",
    "tc_ava_area": "esriFieldTypeString",
    "sc_ava_area": "esriFieldTypeString",
    "en_remarks": "esriFieldTypeString",
    "tc_remarks": "esriFieldTypeString",
    "sc_remarks": "esriFieldTypeString",
    "OBJECTID": "esriFieldTypeOID"
  },
  "geometry": "esriGeometryPoint",
  "label": "Government accommodation for NGOs"
};

export const request1963 = developmentRequest(contract1963);

export const response1963 = developmentResponse(contract1963);
