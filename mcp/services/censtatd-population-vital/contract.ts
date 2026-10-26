import contract0 from "./contracts/110-06814.json";
import contract1 from "./contracts/110-06815.json";
import contract2 from "./contracts/110-06831.json";
import contract3 from "./contracts/110-06832.json";
import contract4 from "./contracts/110-06833.json";
import contract5 from "./contracts/115-01011.json";
import contract6 from "./contracts/115-01012.json";
import contract7 from "./contracts/115-01012a.json";
import contract8 from "./contracts/115-01013.json";
import contract9 from "./contracts/115-01014.json";

export const contracts: Record<string, TableContract> = {
  "110-06814": contract0,
  "110-06815": contract1,
  "110-06831": contract2,
  "110-06832": contract3,
  "110-06833": contract4,
  "115-01011": contract5,
  "115-01012": contract6,
  "115-01012A": contract7,
  "115-01013": contract8,
  "115-01014": contract9,
};

export type TableContract = {
  dimensions: Record<string, string[]>;
  indicators: Record<string, string[]>;
  units: Record<string, Record<string, Record<string, string>>>;
  frequencies: string[];
};
