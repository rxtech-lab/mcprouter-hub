// Source units and indicator/dimension contracts verified against official responses on 2026-10-21.
export const contracts = {
  "315-38031": {
    "dimension": "COUNTRY",
    "byIndicator": {
      "DI_OUTFLOW": {
        "dimension": true,
        "components": [
          "CG",
          "CN",
          "NG"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "DI_POS_ODI": {
        "dimension": true,
        "components": [
          "CG",
          "CN",
          "NG"
        ],
        "measures": [
          "amount_billion"
        ]
      }
    },
    "units": {
      "HK$ billion": "amount_billion",
      "十億港元": "amount_billion",
      "十亿港元": "amount_billion"
    }
  },
  "315-38032": {
    "dimension": "ACTIVITY",
    "byIndicator": {
      "DI_OUTFLOW": {
        "dimension": true,
        "components": [
          "TOTAL",
          "DI_10",
          "DI_100-120",
          "DI_130",
          "DI_30",
          "DI_40",
          "DI_50",
          "DI_60",
          "DI_70",
          "DI_90"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "DI_POS_ODI": {
        "dimension": true,
        "components": [
          "TOTAL",
          "DI_10",
          "DI_100-120",
          "DI_130",
          "DI_30",
          "DI_40",
          "DI_50",
          "DI_60",
          "DI_70",
          "DI_90"
        ],
        "measures": [
          "amount_billion"
        ]
      }
    },
    "units": {
      "HK$ billion": "amount_billion",
      "十億港元": "amount_billion",
      "十亿港元": "amount_billion"
    }
  },
  "340-45001": {
    "dimension": "ISSUER",
    "byIndicator": {
      "LT_AI": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "LT_CIR": {
        "dimension": true,
        "components": [
          "TOTAL",
          "1",
          "2"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "LT_PUB": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "LT_PUB_SA": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_million"
        ]
      }
    },
    "units": {
      "HK$ million": "amount_million",
      "百萬港元": "amount_million",
      "百万港元": "amount_million"
    }
  },
  "340-45011": {
    "dimension": "",
    "byIndicator": {
      "M1": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_million",
          "yoy"
        ]
      },
      "M2": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_million",
          "yoy"
        ]
      },
      "M3": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_million",
          "yoy"
        ]
      }
    },
    "units": {
      "HK$ million": "amount_million",
      "Year-on-year % change": "yoy",
      "百萬港元": "amount_million",
      "按年變動百分率": "yoy",
      "百万港元": "amount_million",
      "按年变动百分率": "yoy"
    }
  },
  "340-45012": {
    "dimension": "CURRENCY",
    "byIndicator": {
      "M1": {
        "dimension": true,
        "components": [
          "TOTAL",
          "1",
          "3"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "M1_SA": {
        "dimension": true,
        "components": [
          "1"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "M2": {
        "dimension": true,
        "components": [
          "TOTAL",
          "1",
          "3"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "M2_SW": {
        "dimension": true,
        "components": [
          "TOTAL",
          "1",
          "3"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "M3": {
        "dimension": true,
        "components": [
          "TOTAL",
          "1",
          "3"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "M3_SW": {
        "dimension": true,
        "components": [
          "TOTAL",
          "1",
          "3"
        ],
        "measures": [
          "amount_million"
        ]
      }
    },
    "units": {
      "HK$ million": "amount_million",
      "百萬港元": "amount_million",
      "百万港元": "amount_million"
    }
  },
  "340-45021": {
    "dimension": "DEP_P_T",
    "byIndicator": {
      "BL_RATE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "interest_rate"
        ]
      },
      "S_DEP_RATE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "interest_rate"
        ]
      },
      "T_DEP_RATE": {
        "dimension": true,
        "components": [
          "12M",
          "1M",
          "1W",
          "3M",
          "6M"
        ],
        "measures": [
          "interest_rate"
        ]
      }
    },
    "units": {
      "(Percent for annum)": "interest_rate",
      "(年率)": "interest_rate"
    }
  },
  "340-45022": {
    "dimension": "MATURITY",
    "byIndicator": {
      "SET_RATE": {
        "dimension": true,
        "components": [
          "0N",
          "1M",
          "1W",
          "3M",
          "6M"
        ],
        "measures": [
          "interest_rate"
        ]
      }
    },
    "units": {
      "Rates at end of period(percent per annum)": "interest_rate",
      "期末息率(年率)": "interest_rate"
    }
  },
  "340-46001": {
    "dimension": "",
    "byIndicator": {
      "FC_AUD": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_CAD": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_CHF": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_CNY": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_EUR": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_GBP": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_IDR": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_INR": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_JPY": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_MYR": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_PHP": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_SGD": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_THB": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_TWD": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_USD": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_WON": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      },
      "FC_ZAR": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "exchange_rate"
        ]
      }
    },
    "units": {
      "HK dollar per unit of foreign currency": "exchange_rate",
      "每單位外幣兌換港元": "exchange_rate",
      "每单位外币兑换港元": "exchange_rate"
    }
  },
  "340-46002": {
    "dimension": "",
    "byIndicator": {
      "EERI_E": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "index"
        ]
      },
      "EERI_I": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "index"
        ]
      },
      "EERI_T": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "index"
        ]
      }
    },
    "units": {
      "Index": "index",
      "指數": "index",
      "指数": "index"
    }
  },
  "340-47001": {
    "dimension": "TYPE_GRA",
    "byIndicator": {
      "EXP_GRA": {
        "dimension": true,
        "components": [
          "EXP_1",
          "EXP_2",
          "EXP_8"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "REV_GRA": {
        "dimension": true,
        "components": [
          "REV_1",
          "REV_2",
          "REV_3",
          "REV_4",
          "REV_5"
        ],
        "measures": [
          "amount_million"
        ]
      }
    },
    "units": {
      "HK$ million": "amount_million",
      "百萬港元": "amount_million",
      "百万港元": "amount_million"
    }
  }
} as const;
