type Contract = { freq: string; indicators: string[]; dimensions: Record<string, { input: string; codes: string[] }>; units: Record<string, string> };

/** Verified against complete official responses in en, tc and sc on 2026-10-23. */
export const contracts: Record<string, Contract> = {
  "330-40001": {
    "freq": "M",
    "indicators": [
      "DI_BR",
      "DI_EM",
      "DI_NO"
    ],
    "dimensions": {
      "IND": {
        "input": "industry",
        "codes": [
          "",
          "ind_SMES_4391_6821_711",
          "ind_SMES_45",
          "ind_SMES_46",
          "ind_SMES_47",
          "ind_SMES_4927_4928_522202_522204",
          "ind_SMES_56",
          "ind_SMES_620_6311_69_702_741_78"
        ]
      },
      "HOR": {
        "input": "horizon",
        "codes": [
          "CUR",
          "OUT"
        ]
      }
    },
    "units": {
      "Index": "index",
      "指數": "index",
      "指数": "index"
    }
  },
  "330-40002": {
    "freq": "M",
    "indicators": [
      "SME_PERCENT"
    ],
    "dimensions": {
      "ACS": {
        "input": "category",
        "codes": [
          "",
          "1.1",
          "1.2",
          "1.3",
          "1.4"
        ]
      }
    },
    "units": {
      "(%)": "percent"
    }
  },
  "330-41001": {
    "freq": "Q",
    "indicators": [
      "HC_PERCENT"
    ],
    "dimensions": {
      "IND": {
        "input": "industry",
        "codes": [
          "",
          "ind_QBTS_45_46",
          "ind_QBTS_47",
          "ind_QBTS_C",
          "ind_QBTS_F",
          "ind_QBTS_H",
          "ind_QBTS_I",
          "ind_QBTS_J",
          "ind_QBTS_K",
          "ind_QBTS_L",
          "ind_QBTS_M_N"
        ]
      },
      "CCBS": {
        "input": "category",
        "codes": [
          "1",
          "2",
          "3",
          "4"
        ]
      }
    },
    "units": {
      "(%)": "percent"
    }
  },
  "330-41002": {
    "freq": "Q",
    "indicators": [
      "HC_PERCENT"
    ],
    "dimensions": {
      "IND": {
        "input": "industry",
        "codes": [
          "ind_QBTS_45_46",
          "ind_QBTS_47",
          "ind_QBTS_C",
          "ind_QBTS_F",
          "ind_QBTS_H",
          "ind_QBTS_I",
          "ind_QBTS_J",
          "ind_QBTS_K",
          "ind_QBTS_L",
          "ind_QBTS_M_N"
        ]
      },
      "CCVL": {
        "input": "category",
        "codes": [
          "1",
          "2",
          "3",
          "4"
        ]
      }
    },
    "units": {
      "(%)": "percent"
    }
  },
  "330-41003": {
    "freq": "Q",
    "indicators": [
      "HC_PERCENT"
    ],
    "dimensions": {
      "IND": {
        "input": "industry",
        "codes": [
          "ind_QBTS_45_46",
          "ind_QBTS_47",
          "ind_QBTS_C",
          "ind_QBTS_F",
          "ind_QBTS_H",
          "ind_QBTS_I",
          "ind_QBTS_J",
          "ind_QBTS_K",
          "ind_QBTS_L",
          "ind_QBTS_M_N"
        ]
      },
      "CCPE": {
        "input": "category",
        "codes": [
          "1",
          "2",
          "3",
          "4"
        ]
      }
    },
    "units": {
      "(%)": "percent"
    }
  },
  "330-41004": {
    "freq": "Q",
    "indicators": [
      "HC_PERCENT"
    ],
    "dimensions": {
      "IND": {
        "input": "industry",
        "codes": [
          "ind_QBTS_45_46",
          "ind_QBTS_47",
          "ind_QBTS_C",
          "ind_QBTS_F",
          "ind_QBTS_H",
          "ind_QBTS_I",
          "ind_QBTS_J",
          "ind_QBTS_K",
          "ind_QBTS_L",
          "ind_QBTS_M_N"
        ]
      },
      "CCPR": {
        "input": "category",
        "codes": [
          "1",
          "2",
          "3",
          "4"
        ]
      }
    },
    "units": {
      "(%)": "percent"
    }
  },
  "330-41011": {
    "freq": "M",
    "indicators": [
      "HC_PERCENT"
    ],
    "dimensions": {
      "IND": {
        "input": "industry",
        "codes": [
          "ind_QBTS_45_46",
          "ind_QBTS_47",
          "ind_QBTS_C",
          "ind_QBTS_F"
        ]
      },
      "VAR": {
        "input": "variable",
        "codes": [
          "1",
          "2",
          "3",
          "4"
        ]
      },
      "CCLEVEL": {
        "input": "category",
        "codes": [
          "1",
          "2",
          "3",
          "4"
        ]
      }
    },
    "units": {
      "(%)": "percent"
    }
  },
  "330-41021": {
    "freq": "Q",
    "indicators": [
      "HC_PERCENT"
    ],
    "dimensions": {
      "IND": {
        "input": "industry",
        "codes": [
          "ind_QBTS_45_46",
          "ind_QBTS_47",
          "ind_QBTS_C",
          "ind_QBTS_F",
          "ind_QBTS_H",
          "ind_QBTS_I",
          "ind_QBTS_J",
          "ind_QBTS_K",
          "ind_QBTS_L",
          "ind_QBTS_M_N"
        ]
      },
      "CCPS": {
        "input": "category",
        "codes": [
          "1",
          "2",
          "3",
          "4"
        ]
      }
    },
    "units": {
      "(%)": "percent"
    }
  },
  "330-41022": {
    "freq": "Q",
    "indicators": [
      "HC_PERCENT"
    ],
    "dimensions": {
      "IND": {
        "input": "industry",
        "codes": [
          "ind_QBTS_45_46",
          "ind_QBTS_47",
          "ind_QBTS_C",
          "ind_QBTS_F",
          "ind_QBTS_H",
          "ind_QBTS_I",
          "ind_QBTS_J",
          "ind_QBTS_K",
          "ind_QBTS_L",
          "ind_QBTS_M_N"
        ]
      },
      "CCFS": {
        "input": "category",
        "codes": [
          "1",
          "2",
          "3",
          "4"
        ]
      }
    },
    "units": {
      "(%)": "percent"
    }
  },
  "330-41023": {
    "freq": "Q",
    "indicators": [
      "HC_PERCENT"
    ],
    "dimensions": {
      "IND": {
        "input": "industry",
        "codes": [
          "ind_QBTS_45_46",
          "ind_QBTS_47",
          "ind_QBTS_C",
          "ind_QBTS_F",
          "ind_QBTS_H",
          "ind_QBTS_I",
          "ind_QBTS_J",
          "ind_QBTS_K",
          "ind_QBTS_L",
          "ind_QBTS_M_N"
        ]
      },
      "CCACS": {
        "input": "category",
        "codes": [
          "1",
          "2",
          "3",
          "4"
        ]
      }
    },
    "units": {
      "(%)": "percent"
    }
  }
};
