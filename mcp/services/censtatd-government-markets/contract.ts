// Verified official table units and indicator/component relationships, 2026-10-21.
export const contracts = {
  "340-47002": {
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
  },
  "340-47011": {
    "dimension": "REV_TYPE",
    "byIndicator": {
      "GOV_REV": {
        "dimension": true,
        "components": [
          "1",
          "1111",
          "1112",
          "1113",
          "1114",
          "1115",
          "121",
          "122",
          "123",
          "124",
          "125",
          "126",
          "127",
          "128",
          "129",
          "12X",
          "12XI",
          "131",
          "132",
          "133",
          "134",
          "135",
          "1361",
          "1362",
          "137",
          "138",
          "2",
          "211",
          "212",
          "221",
          "222",
          "223",
          "2311",
          "2312",
          "232",
          "233",
          "234",
          "235",
          "236",
          "237",
          "TOTAL"
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
  "340-47012": {
    "dimension": "EXP_TYPE",
    "byIndicator": {
      "GOV_EXP": {
        "dimension": true,
        "components": [
          "1",
          "111",
          "112",
          "113",
          "114",
          "115",
          "116",
          "117",
          "131",
          "132",
          "2",
          "21",
          "22",
          "241",
          "242",
          "243",
          "245",
          "246",
          "247",
          "TOTAL"
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
  "340-92002": {
    "dimension": "",
    "byIndicator": {
      "SILVER_CLOSE_P": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "silver_hkd_10oz"
        ]
      },
      "SILVER_HIGH_P": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "silver_hkd_10oz"
        ]
      },
      "SILVER_LOW_P": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "silver_hkd_10oz"
        ]
      },
      "SILVER_OPEN_P": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "silver_hkd_10oz"
        ]
      }
    },
    "units": {
      "(HK$/10 oz.)": "silver_hkd_10oz",
      "(以每10安士港元計)": "silver_hkd_10oz",
      "(以每10安士港元计)": "silver_hkd_10oz"
    }
  },
  "340-95001": {
    "dimension": "",
    "byIndicator": {
      "AVE_DAILY_TRADE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "THREE_M_INTEREST": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "interest_rate"
        ]
      }
    },
    "units": {
      "Period average, % per annum": "interest_rate",
      "HK$ billion": "amount_billion",
      "期內平均數字，年率": "interest_rate",
      "十億港元": "amount_billion",
      "期内平均数字，年率": "interest_rate",
      "十亿港元": "amount_billion"
    }
  },
  "340-95002": {
    "dimension": "",
    "byIndicator": {
      "ADT_EXFBN": {
        "dimension": false,
        "components": [
          "NONE"
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
  "340-95003": {
    "dimension": "SECURITIES_MARKET",
    "byIndicator": {
      "AVG_TURNOVER": {
        "dimension": true,
        "components": [
          "GEM",
          "GEM-H",
          "GEM-OTH_EQ",
          "GEM-OTH_SEC",
          "MB",
          "MB-H",
          "MB-OTH_EQ",
          "MB-OTH_SEC"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "FUND_RAISED": {
        "dimension": true,
        "components": [
          "GEM",
          "GEM-H",
          "GEM-OTH_EQ",
          "GEM-OTH_SEC",
          "MB",
          "MB-H",
          "MB-OTH_EQ",
          "MB-OTH_SEC"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "LC": {
        "dimension": true,
        "components": [
          "GEM",
          "GEM-H",
          "GEM-OTH",
          "MB",
          "MB-H",
          "MB-OTH"
        ],
        "measures": [
          "count"
        ]
      },
      "SEC_ISSUE": {
        "dimension": true,
        "components": [
          "GEM",
          "GEM-ALL_EQ",
          "GEM-OTH_SEC",
          "MB",
          "MB-ALL_EQ",
          "MB-OTH_SEC"
        ],
        "measures": [
          "count"
        ]
      },
      "TMC": {
        "dimension": true,
        "components": [
          "GEM",
          "GEM-H",
          "GEM-OTH",
          "MB",
          "MB-H",
          "MB-OTH"
        ],
        "measures": [
          "amount_billion"
        ]
      }
    },
    "units": {
      "Number": "count",
      "HK$ billion": "amount_billion",
      "HK$ million": "amount_million",
      "數目": "count",
      "十億港元": "amount_billion",
      "百萬港元": "amount_million",
      "数目": "count",
      "十亿港元": "amount_billion",
      "百万港元": "amount_million"
    }
  },
  "340-95004": {
    "dimension": "",
    "byIndicator": {
      "ADT_HKEX": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "contracts"
        ]
      }
    },
    "units": {
      "Number of contracts": "contracts",
      "合約張數": "contracts",
      "合约张数": "contracts"
    }
  },
  "340-95005": {
    "dimension": "",
    "byIndicator": {
      "AVG_DAILY_BUY_SSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "AVG_DAILY_BUY_SZSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "AVG_DAILY_SELL_SSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "AVG_DAILY_SELL_SZSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "AVG_DAILY_TURNOVER_SSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "rmb_billion"
        ]
      },
      "AVG_DAILY_TURNOVER_SZSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "rmb_billion"
        ]
      },
      "BUY_VALUE_SSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "BUY_VALUE_SZSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "SELL_VALUE_SSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "SELL_VALUE_SZSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_billion"
        ]
      },
      "TURNOVER_SSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "rmb_billion"
        ]
      },
      "TURNOVER_SZSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "rmb_billion"
        ]
      }
    },
    "units": {
      "HK$ billion": "amount_billion",
      "RMB billion": "rmb_billion",
      "十億港元": "amount_billion",
      "十億人民幣": "rmb_billion",
      "十亿港元": "amount_billion",
      "十亿人民币": "rmb_billion"
    }
  },
  "340-95006": {
    "dimension": "",
    "byIndicator": {
      "ADT_CGSE": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "amount_million"
        ]
      },
      "ADT_LLG": {
        "dimension": false,
        "components": [
          "NONE"
        ],
        "measures": [
          "usd_million"
        ]
      }
    },
    "units": {
      "HK$ million": "amount_million",
      "US$ million": "usd_million",
      "百萬港元": "amount_million",
      "百萬美元": "usd_million",
      "百万港元": "amount_million",
      "百万美元": "usd_million"
    }
  }
} as const;
