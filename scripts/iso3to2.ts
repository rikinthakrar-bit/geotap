// scripts/iso3to2.ts
// Minimal-but-useful ISO3 -> ISO2 map.
// You can extend this anytime; generator will automatically pick it up.
export const ISO3_TO_ISO2: Record<string, string> = {
  USA: "us", CAN: "ca", MEX: "mx",
  BRA: "br", ARG: "ar", CHL: "cl", COL: "co", PER: "pe", VEN: "ve", URY: "uy", PRY: "py", BOL: "bo",
  GBR: "gb", IRL: "ie", FRA: "fr", DEU: "de", ITA: "it", ESP: "es", PRT: "pt", NLD: "nl", BEL: "be",
  CHE: "ch", AUT: "at", SWE: "se", NOR: "no", DNK: "dk", FIN: "fi", ISL: "is", POL: "pl", CZE: "cz",
  SVK: "sk", SVN: "si", HUN: "hu", ROU: "ro", BGR: "bg", GRC: "gr", TUR: "tr", UKR: "ua",
  RUS: "ru", GEO: "ge", ARM: "am", AZE: "az", MDA: "md", ALB: "al", MKD: "mk", MNE: "me", SRB: "rs", BIH: "ba",
  EST: "ee", LVA: "lv", LTU: "lt", MLT: "mt", LUX: "lu", AND: "ad", MCO: "mc", SMR: "sm", VAT: "va", LIE: "li",
  MAR: "ma", DZA: "dz", TUN: "tn", EGY: "eg", LBY: "ly", SDN: "sd", SSD: "ss", ETH: "et", ERI: "er",
  DJI: "dj", SOM: "so", KEN: "ke", UGA: "ug", TZA: "tz", RWA: "rw", BDI: "bi", COD: "cd", COG: "cg",
  GHA: "gh", CIV: "ci", NGA: "ng", BEN: "bj", TGO: "tg", LBR: "lr", SLE: "sl", GIN: "gn", GNB: "gw",
  SEN: "sn", MRT: "mr", MLI: "ml", NER: "ne", TCD: "td", CAF: "cf", CMR: "cm", GAB: "ga", GNQ: "gq",
  ZAF: "za", NAM: "na", BWA: "bw", ZWE: "zw", ZMB: "zm", MOZ: "mz", AGO: "ao", SWZ: "sz", LSO: "ls",
  SAU: "sa", ARE: "ae", QAT: "qa", KWT: "kw", BHR: "bh", OMN: "om", YEM: "ye", IRN: "ir", IRQ: "iq", ISR: "il", JOR: "jo",
  SYR: "sy", LBN: "lb",
  IND: "in", PAK: "pk", BGD: "bd", LKA: "lk", NPL: "np", BTN: "bt", AFG: "af",
  CHN: "cn", MNG: "mn", JPN: "jp", KOR: "kr", PRK: "kp", TWN: "tw",
  VNM: "vn", THA: "th", KHM: "kh", LAO: "la", MMR: "mm", MYS: "my", SGP: "sg", IDN: "id", PHL: "ph", BRN: "bn", TLS: "tl",
  AUS: "au", NZL: "nz", PNG: "pg", FJI: "fj", SLB: "sb", VUT: "vu", TON: "to", WSM: "ws", KIR: "ki", TUV: "tv",
  
  // Keep adding as needed; the generator will use only those for which a flag exists.
};