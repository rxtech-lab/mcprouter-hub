import { developmentRequest, developmentResponse } from "@/lib/mcp/development-spatial";

const contract2027 = {
  "oid": "OBJECTID",
  "names": {
    "en": "VIL_ENAME",
    "tc": "VIL_CNAME"
  },
  "search": [
    "VIL_ENAME",
    "VIL_CNAME",
    "RCOM_ENAME",
    "RCOM_CNAME",
    "PLANNO"
  ],
  "fields": {
    "OBJECTID": "esriFieldTypeOID",
    "PLANNO": "esriFieldTypeString",
    "RCOM_ENAME": "esriFieldTypeString",
    "RCOM_CNAME": "esriFieldTypeString",
    "VIL_ENAME": "esriFieldTypeString",
    "VIL_CNAME": "esriFieldTypeString",
    "DISTRICT": "esriFieldTypeString",
    "Shape__Length": "esriFieldTypeDouble",
    "Shape__Area": "esriFieldTypeDouble"
  },
  "geometry": "esriGeometryPolygon",
  "label": "Village and market town boundaries 2019-2022"
};

export const request2027 = developmentRequest(contract2027);

export const response2027 = developmentResponse(contract2027);

const contract2028 = {
  "oid": "OBJECTID",
  "names": {
    "en": "VIL_ENAME",
    "tc": "VIL_CNAME"
  },
  "search": [
    "VIL_ENAME",
    "VIL_CNAME",
    "RCOM_ENAME",
    "RCOM_CNAME",
    "PLANNO",
    "HAD_DISTRICT_ENAME",
    "HAD_DISTRICT_CNAME"
  ],
  "fields": {
    "OBJECTID": "esriFieldTypeOID",
    "PLANNO": "esriFieldTypeString",
    "RCOM_ENAME": "esriFieldTypeString",
    "RCOM_CNAME": "esriFieldTypeString",
    "VIL_ENAME": "esriFieldTypeString",
    "VIL_CNAME": "esriFieldTypeString",
    "DISTRICT": "esriFieldTypeString",
    "HAD_DISTRICT_ENAME": "esriFieldTypeString",
    "HAD_DISTRICT_CNAME": "esriFieldTypeString",
    "PDF_EN_URL": "esriFieldTypeString",
    "PDF_CN_URL": "esriFieldTypeString",
    "PDF_ZH_URL": "esriFieldTypeString",
    "HAD_RCOM_CNAME": "esriFieldTypeString",
    "HAD_RCOM_ENAME": "esriFieldTypeString",
    "HAD_VIL_CNAME": "esriFieldTypeString",
    "HAD_VIL_ENAME": "esriFieldTypeString",
    "HAD_MARKET_CNAME": "esriFieldTypeString",
    "HAD_MARKET_ENAME": "esriFieldTypeString",
    "FILE_NAME": "esriFieldTypeString",
    "Shape__Length": "esriFieldTypeDouble",
    "Shape__Area": "esriFieldTypeDouble"
  },
  "geometry": "esriGeometryPolygon",
  "label": "Village and market town boundaries 2023-2026"
};

export const request2028 = developmentRequest(contract2028);

export const response2028 = developmentResponse(contract2028);

const contract2029 = {
  "oid": "OBJECTID",
  "names": {
    "en": "VIL_ENAME",
    "tc": "VIL_CNAME"
  },
  "search": [
    "VIL_ENAME",
    "VIL_CNAME",
    "RCOM_ENAME",
    "RCOM_CNAME",
    "PLANNO",
    "HAD_DISTRICT_ENAME",
    "HAD_DISTRICT_CNAME"
  ],
  "fields": {
    "OBJECTID": "esriFieldTypeOID",
    "PLANNO": "esriFieldTypeString",
    "RCOM_ENAME": "esriFieldTypeString",
    "RCOM_CNAME": "esriFieldTypeString",
    "VIL_ENAME": "esriFieldTypeString",
    "VIL_CNAME": "esriFieldTypeString",
    "DISTRICT": "esriFieldTypeString",
    "HAD_DISTRICT_ENAME": "esriFieldTypeString",
    "HAD_DISTRICT_CNAME": "esriFieldTypeString",
    "PDF_EN_URL": "esriFieldTypeString",
    "PDF_CN_URL": "esriFieldTypeString",
    "PDF_ZH_URL": "esriFieldTypeString",
    "HAD_RCOM_CNAME": "esriFieldTypeString",
    "HAD_RCOM_ENAME": "esriFieldTypeString",
    "HAD_VIL_CNAME": "esriFieldTypeString",
    "HAD_VIL_ENAME": "esriFieldTypeString",
    "HAD_MARKET_CNAME": "esriFieldTypeString",
    "HAD_MARKET_ENAME": "esriFieldTypeString",
    "FILE_NAME": "esriFieldTypeString",
    "Shape__Length": "esriFieldTypeDouble",
    "Shape__Area": "esriFieldTypeDouble"
  },
  "geometry": "esriGeometryPolygon",
  "label": "Village and market town boundaries 2027-2030"
};

export const request2029 = developmentRequest(contract2029);

export const response2029 = developmentResponse(contract2029);

const history = {
  "1999": {
    "oid": "OBJECTID",
    "names": {
      "en": "DISTRICT_ENG",
      "tc": "DISTRICT_CHI"
    },
    "search": [
      "DISTRICT_ENG",
      "DISTRICT_CHI",
      "DISTRICT_CODE"
    ],
    "fields": {
      "OBJECTID": "esriFieldTypeOID",
      "DISTRICT_CODE": "esriFieldTypeString",
      "DISTRICT_CHI": "esriFieldTypeString",
      "DISTRICT_ENG": "esriFieldTypeString",
      "Shape__Length": "esriFieldTypeDouble",
      "Shape__Area": "esriFieldTypeDouble"
    },
    "geometry": "esriGeometryPolygon",
    "label": "Historical district boundaries"
  },
  "2003": {
    "oid": "OBJECTID",
    "names": {
      "en": "DISTRICT_ENG",
      "tc": "DISTRICT_CHI"
    },
    "search": [
      "DISTRICT_ENG",
      "DISTRICT_CHI",
      "DISTRICT_CODE"
    ],
    "fields": {
      "OBJECTID": "esriFieldTypeOID",
      "DISTRICT_CODE": "esriFieldTypeString",
      "DISTRICT_CHI": "esriFieldTypeString",
      "DISTRICT_ENG": "esriFieldTypeString",
      "Shape__Length": "esriFieldTypeDouble",
      "Shape__Area": "esriFieldTypeDouble"
    },
    "geometry": "esriGeometryPolygon",
    "label": "Historical district boundaries"
  },
  "2007": {
    "oid": "OBJECTID",
    "names": {
      "en": "DISTRICT_ENG",
      "tc": "DISTRICT_CHI"
    },
    "search": [
      "DISTRICT_ENG",
      "DISTRICT_CHI",
      "DISTRICT_CODE"
    ],
    "fields": {
      "OBJECTID": "esriFieldTypeOID",
      "DISTRICT_CODE": "esriFieldTypeString",
      "DISTRICT_CHI": "esriFieldTypeString",
      "DISTRICT_ENG": "esriFieldTypeString",
      "Shape__Length": "esriFieldTypeDouble",
      "Shape__Area": "esriFieldTypeDouble"
    },
    "geometry": "esriGeometryPolygon",
    "label": "Historical district boundaries"
  },
  "2015": {
    "oid": "OBJECTID",
    "names": {
      "en": "NAME_EN",
      "tc": "NAME_TC"
    },
    "search": [
      "NAME_EN",
      "NAME_TC",
      "AREA_CODE",
      "AREA_ID"
    ],
    "fields": {
      "OBJECTID": "esriFieldTypeOID",
      "CSDI_ADMIN_AREA_ID": "esriFieldTypeString",
      "AREA_TYPE": "esriFieldTypeString",
      "AREA_ID": "esriFieldTypeString",
      "AREA_CODE": "esriFieldTypeString",
      "NAME_TC": "esriFieldTypeString",
      "NAME_EN": "esriFieldTypeString",
      "DATA_OWNER": "esriFieldTypeString",
      "BEGIN_LIFESPAN": "esriFieldTypeDate",
      "END_LIFESPAN": "esriFieldTypeDate",
      "Shape__Length": "esriFieldTypeDouble",
      "Shape__Area": "esriFieldTypeDouble"
    },
    "geometry": "esriGeometryPolygon",
    "label": "Historical district boundaries"
  }
};

export const request2031: import("@/lib/mcp/types").RequestTransformer = (request, input, context) => { const year = String(input.year) as keyof typeof history; const layer = { "1999": 2, "2003": 0, "2007": 1, "2015": 3 }[year]; return developmentRequest(history[year])({ ...request, url: request.url.replace("/FeatureServer/0/", `/FeatureServer/${layer}/`) }, input, context); };

export const response2031: import("@/lib/mcp/types").ResponseTransformer = (body, input, context) => developmentResponse(history[String(input.year) as keyof typeof history])(body, input, context);

const contract2033 = {
  "oid": "OBJECTID",
  "names": {
    "en": "NAME_EN",
    "tc": "NAME_TC"
  },
  "search": [
    "NAME_EN",
    "NAME_TC",
    "AREA_CODE",
    "AREA_ID",
    "REGION"
  ],
  "fields": {
    "OBJECTID": "esriFieldTypeOID",
    "AREA_ID": "esriFieldTypeString",
    "AREA_CODE": "esriFieldTypeString",
    "NAME_TC": "esriFieldTypeString",
    "NAME_EN": "esriFieldTypeString",
    "REGION": "esriFieldTypeString",
    "Shape__Length": "esriFieldTypeDouble",
    "Shape__Area": "esriFieldTypeDouble"
  },
  "geometry": "esriGeometryPolygon",
  "label": "District boundaries"
};

export const request2033 = developmentRequest(contract2033);

export const response2033 = developmentResponse(contract2033);

const contract2044 = {
  "oid": "OBJECTID",
  "names": {
    "en": "pbg_name_en",
    "tc": "pbg_name_tc"
  },
  "search": [
    "pbg_name_en",
    "pbg_name_tc",
    "site_code"
  ],
  "fields": {
    "site_code": "esriFieldTypeString",
    "pbg_name_tc": "esriFieldTypeString",
    "pbg_name_en": "esriFieldTypeString",
    "last_update_date": "esriFieldTypeDate",
    "fid": "esriFieldTypeString",
    "OBJECTID": "esriFieldTypeOID",
    "Shape__Length": "esriFieldTypeDouble",
    "Shape__Area": "esriFieldTypeDouble"
  },
  "geometry": "esriGeometryPolygon",
  "label": "Permitted burial ground boundaries"
};

export const request2044 = developmentRequest(contract2044);

export const response2044 = developmentResponse(contract2044);
