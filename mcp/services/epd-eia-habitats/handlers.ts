import { spatialQuery } from "@/lib/mcp/spatial";
import type { ToolHandler } from "@/lib/mcp/types";

// Captured CSDI layer metadata, 2026-10-22. Field case and unique ID differ by layer.
const layers = [
  {
    "id": 0,
    "name": "SeasonalWatercourse",
    "objectIdField": "OBJECTID_1",
    "fields": {
      "report": "ReportName",
      "district": "District",
      "habitat": "LayerName"
    }
  },
  {
    "id": 1,
    "name": "woodland",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "reportname",
      "district": "district",
      "habitat": "layername"
    }
  },
  {
    "id": 2,
    "name": "Wetland",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "reportname",
      "district": "district",
      "habitat": "layername"
    }
  },
  {
    "id": 3,
    "name": "Watercourse",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "reportname",
      "district": "district",
      "habitat": "layername"
    }
  },
  {
    "id": 4,
    "name": "Wasteland",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "ReportName",
      "district": "District",
      "habitat": "LayerName"
    }
  },
  {
    "id": 5,
    "name": "VillageArea",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "ReportName",
      "district": "District",
      "habitat": "LayerName"
    }
  },
  {
    "id": 6,
    "name": "UplandGrassland",
    "objectIdField": "OBJECTID_1",
    "fields": {
      "report": "ReportName",
      "district": "District",
      "habitat": "LayerName"
    }
  },
  {
    "id": 7,
    "name": "SSSI",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "reportname",
      "district": "district",
      "habitat": "layername"
    }
  },
  {
    "id": 8,
    "name": "Shrubland",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "ReportName",
      "district": "District",
      "habitat": "LayerName"
    }
  },
  {
    "id": 9,
    "name": "Pond",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "reportname",
      "district": "district",
      "habitat": "layername"
    }
  },
  {
    "id": 10,
    "name": "Plantation",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "reportname",
      "district": "district",
      "habitat": "layername"
    }
  },
  {
    "id": 11,
    "name": "Marsh",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "ReportName",
      "district": "District",
      "habitat": "LayerName"
    }
  },
  {
    "id": 12,
    "name": "GrasslandShrubland",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "reportname",
      "district": "district",
      "habitat": "layername"
    }
  },
  {
    "id": 13,
    "name": "Grassland",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "EIA_No",
      "district": "District",
      "habitat": "Name"
    }
  },
  {
    "id": 14,
    "name": "DevelopedArea",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "reportname",
      "district": "district",
      "habitat": "layername"
    }
  },
  {
    "id": 15,
    "name": "AgriculturalLand",
    "objectIdField": "OBJECTID",
    "fields": {
      "report": "EIA_No",
      "district": "district",
      "habitat": "layername"
    }
  }
] as const;

export const habitats: ToolHandler = (input, context) => {
  const layer = layers.find((candidate) => candidate.name === String(input.habitat ?? layers[0].name));
  if (!layer) throw new Error("Select a published habitat layer from the tool schema.");
  const key = String(input.searchField ?? "report");
  if (key !== "report" && key !== "district" && key !== "habitat") throw new Error("Select report, district or habitat as searchField.");
  return spatialQuery("epd_rcd_1696985725838_7798", [layer.fields[key]], { en: layer.fields.report }, { layer: layer.id, objectIdField: layer.objectIdField })(input, context);
};
