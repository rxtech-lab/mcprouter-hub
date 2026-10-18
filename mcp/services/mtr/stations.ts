// MTR line colours and station names, shared by the app and the chat card.

export const LINES: Record<string, { name: string; colour: string }> = {
  AEL: { name: "Airport Express", colour: "#00888a" },
  TCL: { name: "Tung Chung Line", colour: "#f7943e" },
  TML: { name: "Tuen Ma Line", colour: "#923011" },
  TKL: { name: "Tseung Kwan O Line", colour: "#7d499d" },
  EAL: { name: "East Rail Line", colour: "#53b7e8" },
  SIL: { name: "South Island Line", colour: "#bac429" },
  TWL: { name: "Tsuen Wan Line", colour: "#e2231a" },
  ISL: { name: "Island Line", colour: "#0075c2" },
  KTL: { name: "Kwun Tong Line", colour: "#00ab4e" },
  DRL: { name: "Disneyland Resort Line", colour: "#f173ac" },
};

export const STATIONS: Record<string, string> = {
  ADM: "Admiralty", AIR: "Airport", AUS: "Austin", AWE: "AsiaWorld-Expo", CAB: "Causeway Bay", CEN: "Central", CHH: "Choi Hung",
  CHW: "Chai Wan", CIO: "City One", CKT: "Che Kung Temple", CSW: "Cheung Sha Wan", DIH: "Diamond Hill", DIS: "Disneyland Resort",
  ETS: "East Tsim Sha Tsui", EXC: "Exhibition Centre", FAN: "Fanling", FOH: "Fortress Hill", FOT: "Fo Tan", HAH: "Hang Hau",
  HEO: "Heng On", HFC: "Heng Fa Chuen", HIK: "Hin Keng", HKU: "HKU", HOK: "Hong Kong", HOM: "Ho Man Tin", HUH: "Hung Hom",
  JOR: "Jordan", KAT: "Kai Tak", KET: "Kennedy Town", KOB: "Kowloon Bay", KOT: "Kowloon Tong", KOW: "Kowloon", KSR: "Kam Sheung Road",
  KWF: "Kwai Fong", KWH: "Kwai Hing", KWT: "Kwun Tong", LAK: "Lai King", LAT: "Lam Tin", LCK: "Lai Chi Kok", LET: "Lei Tung",
  LHP: "LOHAS Park", LMC: "Lok Ma Chau", LOF: "Lok Fu", LOP: "Long Ping", LOW: "Lo Wu", MEF: "Mei Foo", MKK: "Mong Kok East",
  MOK: "Mong Kok", MOS: "Ma On Shan", NAC: "Nam Cheong", NOP: "North Point", NTK: "Ngau Tau Kok", OCP: "Ocean Park", OLY: "Olympic",
  POA: "Po Lam", PRE: "Prince Edward", QUB: "Quarry Bay", RAC: "Racecourse", SHM: "Shek Mun", SHS: "Sheung Shui", SHT: "Sha Tin",
  SHW: "Sheung Wan", SIH: "Siu Hong", SKM: "Shek Kip Mei", SKW: "Shau Kei Wan", SOH: "South Horizons", SSP: "Sham Shui Po",
  STW: "Sha Tin Wai", SUN: "Sunny Bay", SUW: "Sung Wong Toi", SWH: "Sai Wan Ho", SYP: "Sai Ying Pun", TAK: "Tai Koo", TAP: "Tai Po Market",
  TAW: "Tai Wai", TIH: "Tin Hau", TIK: "Tiu Keng Leng", TIS: "Tin Shui Wai", TKO: "Tseung Kwan O", TKW: "To Kwa Wan", TSH: "Tai Shui Hang",
  TST: "Tsim Sha Tsui", TSW: "Tsuen Wan", TSY: "Tsing Yi", TUC: "Tung Chung", TUM: "Tuen Mun", TWH: "Tai Wo Hau", TWO: "Tai Wo",
  TWW: "Tsuen Wan West", UNI: "University", WAC: "Wan Chai", WCH: "Wong Chuk Hang", WHA: "Whampoa", WKS: "Wu Kai Sha", WTS: "Wong Tai Sin",
  YAT: "Yau Tong", YMT: "Yau Ma Tei", YUL: "Yuen Long",
};

export const station = (code: string) => STATIONS[code] ?? code;
