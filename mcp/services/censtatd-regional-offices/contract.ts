/** Observed units and indicators in official en/tc/sc responses. */
export const contracts: Record<string, { indicator: string; units: Record<string, string> }> = {
  "325-43001": {
    "indicator": "NO",
    "units": {
      "Number": "count",
      "數目": "count",
      "数目": "count"
    }
  },
  "325-43002": {
    "indicator": "PE_SCOP",
    "units": {
      "No.": "count",
      "數目": "count",
      "数目": "count"
    }
  },
  "325-43011": {
    "indicator": "NO",
    "units": {
      "Number": "count",
      "(%)": "percent",
      "數目": "count",
      "（%）": "percent",
      "数目": "count"
    }
  }
};
