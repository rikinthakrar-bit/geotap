import countries from "../assets/countries-110m.json";
import usStates from "../assets/us-states.json";
import type { Question } from "./questions";

// ---------- ISO helpers for robust flag -> polygon lookups ----------
const ISO2_TO_ISO3: Record<string, string> = {
  // Minimal set now; expand later via a script
  nl: "NLD", al: "ALB", af: "AFG", ad: "AND", ae: "ARE", ar: "ARG", at: "AUT",
  au: "AUS", az: "AZE", ba: "BIH", bd: "BGD", be: "BEL", bg: "BGR", bh: "BHR",
  bi: "BDI", bj: "BEN", bn: "BRN", bo: "BOL", br: "BRA", bs: "BHS", bt: "BTN",
  bw: "BWA", by: "BLR", bz: "BLZ", ca: "CAN", cd: "COD", cf: "CAF", cg: "COG",
  ch: "CHE", ci: "CIV", cl: "CHL", cm: "CMR", cn: "CHN", co: "COL", cr: "CRI",
  cu: "CUB", cv: "CPV", cy: "CYP", cz: "CZE", de: "DEU", dj: "DJI", dk: "DNK",
  dm: "DMA", do: "DOM", dz: "DZA", ec: "ECU", ee: "EST", eg: "EGY", er: "ERI",
  es: "ESP", et: "ETH", fi: "FIN", fj: "FJI", fr: "FRA", ga: "GAB", gb: "GBR",
  ge: "GEO", gh: "GHA", gm: "GMB", gn: "GIN", gq: "GNQ", gr: "GRC", gt: "GTM",
  gw: "GNB", gy: "GUY", hn: "HND", hr: "HRV", ht: "HTI", hu: "HUN", id: "IDN",
  ie: "IRL", il: "ISR", in: "IND", iq: "IRQ", ir: "IRN", is: "ISL", it: "ITA",
  jm: "JAM", jo: "JOR", jp: "JPN", ke: "KEN", kg: "KGZ", kh: "KHM", ki: "KIR",
  km: "COM", kn: "KNA", kp: "PRK", kr: "KOR", kw: "KWT", kz: "KAZ", la: "LAO",
  lb: "LBN", lc: "LCA", li: "LIE", lk: "LKA", lr: "LBR", ls: "LSO", lt: "LTU",
  lu: "LUX", lv: "LVA", ly: "LBY", ma: "MAR", mc: "MCO", md: "MDA", me: "MNE",
  mg: "MDG", mh: "MHL", mk: "MKD", ml: "MLI", mm: "MMR", mn: "MNG", mr: "MRT",
  mt: "MLT", mu: "MUS", mv: "MDV", mw: "MWI", mx: "MEX", my: "MYS", mz: "MOZ",
  na: "NAM", ne: "NER", ng: "NGA", ni: "NIC", no: "NOR", np: "NPL", nz: "NZL",
  om: "OMN", pa: "PAN", pe: "PER", pg: "PNG", ph: "PHL", pk: "PAK", pl: "POL",
  ps: "PSE", pt: "PRT", py: "PRY", qa: "QAT", ro: "ROU", rs: "SRB", ru: "RUS",
  rw: "RWA", sa: "SAU", sb: "SLB", sc: "SYC", sd: "SDN", se: "SWE", sg: "SGP",
  si: "SVN", sk: "SVK", sl: "SLE", sm: "SMR", sn: "SEN", so: "SOM", sr: "SUR",
  ss: "SSD", st: "STP", sv: "SLV", sy: "SYR", sz: "SWZ", td: "TCD", tg: "TGO",
  th: "THA", tj: "TJK", tl: "TLS", tm: "TKM", tn: "TUN", to: "TON", tr: "TUR",
  tt: "TTO", tv: "TUV", tz: "TZA", ua: "UKR", ug: "UGA", us: "USA", uy: "URY",
  uz: "UZB", va: "VAT", vc: "VCT", ve: "VEN", vn: "VNM", ws: "WSM", ye: "YEM",
  za: "ZAF", zm: "ZMB", zw: "ZWE"
};

const ISO2_TO_NAME: Record<string, string> = {
  nl: "Netherlands",
  al: "Albania",
  // A few common ones; can be expanded later
  us: "United States of America",
  gb: "United Kingdom",
  fr: "France",
  de: "Germany",
  it: "Italy",
  es: "Spain",
  jp: "Japan",
  cn: "China",
  in: "India",
  br: "Brazil",
  ca: "Canada",
};

function iso2FromFlagQuestion(q: any): string | null {
  // flags are authored as: name: "AE" or image: "flags/ae.png"
  // Try both, and fall back to q.code if present.
  if (q?.name && typeof q.name === "string" && q.name.length === 2) {
    return q.name.toLowerCase();
  }
  if (q?.image && typeof q.image === "string") {
    const m = q.image.match(/flags\/([a-z]{2})\.png$/i);
    if (m) return m[1].toLowerCase();
  }
  if (q?.code && typeof q.code === "string" && q.code.length === 2) {
    return q.code.toLowerCase();
  }
  return null;
}

function featureFromIso2(iso2: string) {
  const upper2 = iso2.toUpperCase();
  const iso3 = ISO2_TO_ISO3[iso2] || ISO2_TO_ISO3[upper2.toLowerCase()] || null;

  const feats = (countries as any)?.features || [];
  if (!Array.isArray(feats) || feats.length === 0) {
    return null;
  }

  // 1) Try by explicit ISO A2 fields if present in your data
  let found = feats.find((f: any) => {
    const p = f.properties || {};
    return (p.ISO_A2_EH === upper2 || p.ISO_A2 === upper2);
  });
  if (found) return found;

  // 2) Try by id (ISO3) – Natural Earth commonly stores ISO3 in `id`
  if (iso3) {
    found = feats.find(
      (f: any) => typeof f.id === "string" && f.id.toUpperCase() === iso3
    );
    if (found) return found;
  }

  // 3) Try by common name properties
  const wantName = ISO2_TO_NAME[iso2] || ISO2_TO_NAME[upper2.toLowerCase()];
  if (wantName) {
    found = feats.find((f: any) => {
      const p = f.properties || {};
      return (
        p.name === wantName ||
        p.NAME === wantName ||
        p.ADMIN === wantName ||
        p.SOVEREIGNT === wantName
      );
    });
    if (found) return found;
  }

  return null;
}

const norm = (v: any) => (typeof v === "string" ? v.trim().toUpperCase() : "");

export const findFeatureForQuestion = (question: Question) => {
  // Prefer robust ISO2 path for flags
  if (question.type === "flag") {
    // derive iso2 from name/code/image
    const iso2 = iso2FromFlagQuestion(question as any);
    if (iso2) {
      const via2 = featureFromIso2(iso2);
      if (via2) return via2;
    }
    // fall through to generic logic if needed
  }

  if (question.type === "country" || question.type === "flag") {
    // try generic name/ISO matches
    const want = norm((question as any).featureId || (question as any).answer || (question as any).name || "");
    const feats = (countries as any).features || [];
    // Try by properties name first
    let feat = feats.find((f: any) => {
      const p = f.properties || {};
      return (
        norm(p.NAME) === want ||
        norm(p.name) === want ||
        norm(f.id) === want
      );
    });
    if (feat) return feat;

    // If 'want' is ISO3, attempt to convert to ISO2 then lookup, or vice versa
    if (want.length === 2) {
      const via2 = featureFromIso2(want.toLowerCase());
      if (via2) return via2;
    }
    if (want.length === 3) {
      const iso2Guess = Object.keys(ISO2_TO_ISO3).find(k => ISO2_TO_ISO3[k] === want);
      if (iso2Guess) {
        const via3 = featureFromIso2(iso2Guess);
        if (via3) return via3;
      }
    }
    return null;
  }

  if (question.type === "state") {
    const want = norm(question.featureId);
    return (usStates as any).features?.find((f: any) => {
      const p = f.properties || {};
      return (
        norm(p.NAME) === want ||
        norm(p.STUSPS) === want ||
        norm(p.name) === want ||
        norm(f.id) === want
      );
    }) || null;
  }

  return null; // point/image don't need polygons
};