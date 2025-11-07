// ---- Question type helpers ----
function qType(q: any): string {
  return String(q?.type ?? "").toLowerCase();
}
function isFlagQuestion(q: any): boolean {
  const t = qType(q);
  const k = (q?.kind ?? "").toLowerCase();
  return t === "flag" || t === "flags" || k === "flag";
}
function isCountryLikeQuestion(q: any): boolean {
  const t = qType(q);
  const k = (q?.kind ?? "").toLowerCase();
  // Country polygons include explicit country questions and flag questions
  return t === "country" || t === "flag" || t === "flags" || k === "flag";
}
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import countries from "../assets/countries-110m.json";
import usStates from "../assets/us-states.json";
import { getDailySet, todayISO } from "../lib/daily";
import { getDeviceId } from "../lib/device";
import { getFlagSource } from "../lib/flags";
import { addResult, hasPlayed } from "../lib/lbStore";
import { loadQuestions } from "../lib/loadQuestions";
import { fetchRange, upsertDaily } from "../lib/publicResults";
import { type Question } from "../lib/questions";
import { incrementChallengeLevel, saveSummary } from "../lib/storage";

type CountryFeature = {
  id?: string;
  properties?: {
    name?: string;
    NAME?: string;
    ADMIN?: string;
    ISO_A2_EH?: string;
    ISO_A2?: string;
    NAME_LONG?: string;
    SOVEREIGNT?: string;
    BRK_NAME?: string;
    WB_A2?: string;
    ADM0_A3?: string;
  };
  geometry: any;
};

const COUNTRY_FEATURES: CountryFeature[] = (countries as any).features || [];

function normKey(s: string) {
  return s.toLowerCase().replace(/[\s_\-’'`.()]/g, "");
}

const featureByKey: Record<string, CountryFeature> = {};
for (const f of COUNTRY_FEATURES) {
  const keys = [
    f.id,                        // e.g., "AFG"
    f.properties?.name,          // "Afghanistan"
    f.properties?.NAME,          // sometimes present
    f.properties?.NAME_LONG,     // long name
    f.properties?.ADMIN,         // admin name
    f.properties?.SOVEREIGNT,    // sovereign name
    f.properties?.BRK_NAME,      // alt/broken name used in some NE variants
    f.properties?.ISO_A2_EH,     // two-letter code (preferred in NE)
    f.properties?.ISO_A2,        // fallback two-letter code
    f.properties?.WB_A2,         // World Bank A2 code (some small islands)
    f.properties?.ADM0_A3,       // alternative A3 code
  ].filter(Boolean) as string[];

  for (const k of keys) featureByKey[normKey(k)] = f;
}

/** Use the country "featureId" from questions.json (name or code) */
function findCountryFeature(featureId: string) {
  return featureByKey[normKey(featureId)];
}
const COLORS = {
  questionBg: "#0d1b2a",
  questionText: "#ffffff",
  timerBg: "#e53935",
  timerText: "#ffffff",
  brand: "#1e88e5",
};

// Map presets for Practice topics (MapLibre view framing)
type InitialRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
const PRACTICE_REGION: Record<string, InitialRegion> = {
  region_europe:   { latitude: 54,  longitude: 15,   latitudeDelta: 40,  longitudeDelta: 60  },
  region_asia:     { latitude: 34,  longitude: 90,   latitudeDelta: 60,  longitudeDelta: 120 },
  region_africa:   { latitude: 1,   longitude: 20,   latitudeDelta: 55,  longitudeDelta: 60  },
  region_americas: { latitude: 15,  longitude: -85,  latitudeDelta: 100, longitudeDelta: 120 },
  region_oceania:  { latitude: -20, longitude: 140,  latitudeDelta: 40,  longitudeDelta: 70  },
  // US states drill (zoom over the US)
  states:          { latitude: 39.5, longitude: -98.35, latitudeDelta: 25, longitudeDelta: 60 },
};

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.12,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

const MAX_DISTANCE_KM = 10000;
const QUESTION_SECONDS = 20;

const PLAYED_FLAG_PREFIX = "played_v1:"; // Fast local guard fallback

async function getPlayedFlag(dateISO: string) {
  try { return (await AsyncStorage.getItem(PLAYED_FLAG_PREFIX + dateISO)) === "1"; } catch { return false; }
}
async function setPlayedFlag(dateISO: string) {
  try { await AsyncStorage.setItem(PLAYED_FLAG_PREFIX + dateISO, "1"); } catch {}
}

// --- Supabase client + H2H helper ---
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * If both you and a friend have played on `dateISO`, upsert a canonical H2H daily row
 * keyed by (date, a_device_id, b_device_id). Pairs are stored as (least, greatest) for idempotence.
 */
async function upsertDailyH2HIfBothPlayed(dateISO: string, myTotalKm: number) {
  try {
    if (!supabase) return; // skip if env not set
    const me = await getDeviceId();

    // Load friend device IDs from local cache
    const raw = (await AsyncStorage.getItem("friends_v1")) || "[]";
    const friends: Array<{ deviceId: string }> = JSON.parse(raw);
    if (!Array.isArray(friends) || friends.length === 0) return;

    for (const f of friends) {
      const fid = f?.deviceId;
      if (!fid) continue;
      // Fetch friend's score for the same day
      const theirs = await fetchRange(fid, dateISO, dateISO);
      const theirKm = (theirs && theirs[0] && typeof (theirs[0] as any).totalKm === "number")
        ? (theirs[0] as any).totalKm as number
        : null;
      if (theirKm == null) continue; // only upsert once both have a score

      // Canonicalize pair ordering
      const a = me < fid ? me : fid;
      const b = me < fid ? fid : me;
      const a_km = me < fid ? myTotalKm : theirKm;
      const b_km = me < fid ? theirKm : myTotalKm;
      const winner = a_km === b_km ? "draw" : (a_km < b_km ? "a" : "b");

      await supabase
        .from("h2h_daily")
        .upsert(
          { date: dateISO, a_device_id: a, b_device_id: b, a_km, b_km, winner },
          { onConflict: "date,a_device_id,b_device_id" }
        );
    }
  } catch (e) {
    console.warn("H2H upsert skipped:", e);
  }
}

// Safely convert a string URL or a local module into an Image source
function asImageSource(img: any) {
  if (!img) return undefined as any;
  return typeof img === "string" ? { uri: img } : img;
}

// ---------- helpers ----------
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatPrompt(q: Question): string {
  // 1) Respect explicit prompt if provided
  if (q && typeof (q as any).prompt === "string" && (q as any).prompt.trim().length > 0) {
    const p = (q as any).prompt.trim();
    if (!/^(undefined|null)$/i.test(p)) return p;
  }

  // 2) Derive a display label from the richest available fields
  let bestLabel: any =
    (q as any)?.answer ??
    (q as any)?.name ??
    (q as any)?.featureName ??
    (q as any)?.featureId ??
    (q as any)?.countryName ??
    (q as any)?.country ??
    "";

    // Map presets for practice topics (react-native-maps initialRegion format)
type InitialRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

  // Normalize and sanitize
  if (bestLabel == null) bestLabel = "";
  if (typeof bestLabel !== "string") bestLabel = String(bestLabel);
  bestLabel = bestLabel.trim();
  if (/^(undefined|null)$/i.test(bestLabel)) bestLabel = "";

  const t = qType(q);
  const k = (q as any)?.kind;

  // If it's a country/flag and bestLabel looks like a short code, expand to country name
  const looksLikeCode = typeof bestLabel === "string" && bestLabel.length <= 3 && bestLabel.length > 0;
  if ((t === "country" || t === "flag" || t === "flags" || k === "flag") && looksLikeCode) {
    const feat = findCountryFeature(String(bestLabel));
    const name =
      feat?.properties?.NAME ||
      feat?.properties?.name ||
      feat?.properties?.ADMIN ||
      "";
    if (name && !/^(undefined|null)$/i.test(name)) {
      bestLabel = String(name);
    }
  }

  // City questions
  if (t === "point" && (q as any)?.kind === "city") {
    const city = ((q as any)?.name || bestLabel || "").toString().trim();
    const rawCountry = (q as any)?.countryName || (q as any)?.country || (q as any)?.adm0name || "";
    const countryLabel = getCountryLabelFromQuestion(q, rawCountry);

    if (city && !/^(undefined|null)$/i.test(city)) {
      return countryLabel ? `Where is ${city}, ${countryLabel}?` : `Where is ${city}?`;
    }
    return "Where is this city?";
  }

  // Flags
  if (isFlagQuestion(q)) {
    return "FLAG: Which country?";
  }

  // Image questions
  if (t === "image") {
    return "Where is this?";
  }

  // Country questions
  if (t === "country") {
    return bestLabel ? `Where is ${bestLabel}?` : "Where is this country?";
  }

  // State questions
  if (t === "state") {
    return bestLabel ? `Where is ${bestLabel}?` : "Where is this state?";
  }

  // Generic fallback
  return bestLabel ? `Where is ${bestLabel}?` : "Where is this?";
}

function formatAnswerLabel(q: Question): string {
  const t = qType(q);
  const k = (q as any)?.kind;

  const bestCountry = (raw?: any) => getCountryLabelFromQuestion(q as any, raw);

  // Flags → country name
  if (isFlagQuestion(q)) {
    const iso2 = extractIso2FromQuestion(q);
    if (iso2 && ISO2_TO_NAME[iso2]) return ISO2_TO_NAME[iso2];
    const raw =
      (q as any)?.countryName ||
      (q as any)?.country ||
      (q as any)?.answer ||
      (q as any)?.name;
    const label = bestCountry(raw);
    return (label && label.trim()) ? label : (typeof raw === "string" ? raw.trim() : "");
  }

  // Countries → full country name
  if (t === "country" || k === "country") {
    const raw =
      (q as any)?.countryName ||
      (q as any)?.answer ||
      (q as any)?.name ||
      (q as any)?.featureId;
    const label = bestCountry(raw);
    return (label && label.trim()) ? label : (typeof raw === "string" ? raw.trim() : "");
  }

  // Cities → "City, Country"
  if ((t === "point" && k === "city") || k === "capital" || t === "city") {
    const city = ((q as any)?.name || (q as any)?.answer || "").toString().trim();
    const country = bestCountry(
      (q as any)?.countryName || (q as any)?.country || (q as any)?.adm0name || (q as any)?.iso2 || (q as any)?.iso3
    );
    if (city && country) return `${city}, ${country}`;
    return city || country || "";
  }

  // States → "<State>, United States"
  if (t === "state" || k === "state") {
    const state = ((q as any)?.name || (q as any)?.answer || "").toString().trim();
    return state ? `${state}, United States` : "United States";
  }

  // Generic fallback
  const label =
    (q as any)?.answer ||
    (q as any)?.name ||
    (q as any)?.featureName ||
    (q as any)?.countryName ||
    (q as any)?.country ||
    "";
  return typeof label === "string" ? label : String(label ?? "");
}

// ---- ISO2 → Country Name lookup and helpers ----
// Full ISO2 → country name lookup table (ISO 3166-1 alpha-2)
const ISO2_TO_NAME: Record<string, string> = {
  af: "Afghanistan", ax: "Åland Islands", al: "Albania", dz: "Algeria", as: "American Samoa", ad: "Andorra", ao: "Angola", ai: "Anguilla",
  aq: "Antarctica", ag: "Antigua and Barbuda", ar: "Argentina", am: "Armenia", aw: "Aruba", au: "Australia", at: "Austria", az: "Azerbaijan",
  bs: "Bahamas", bh: "Bahrain", bd: "Bangladesh", bb: "Barbados", by: "Belarus", be: "Belgium", bz: "Belize", bj: "Benin",
  bm: "Bermuda", bt: "Bhutan", bo: "Bolivia", bq: "Bonaire, Sint Eustatius and Saba", ba: "Bosnia and Herzegovina", bw: "Botswana", bv: "Bouvet Island", br: "Brazil",
  io: "British Indian Ocean Territory", bn: "Brunei", bg: "Bulgaria", bf: "Burkina Faso", bi: "Burundi", kh: "Cambodia", cm: "Cameroon", ca: "Canada",
  cv: "Cape Verde", ky: "Cayman Islands", cf: "Central African Republic", td: "Chad", cl: "Chile", cn: "China", cx: "Christmas Island", cc: "Cocos (Keeling) Islands",
  co: "Colombia", km: "Comoros", cg: "Congo", cd: "Congo (Democratic Republic)", ck: "Cook Islands", cr: "Costa Rica", ci: "Côte d’Ivoire", hr: "Croatia",
  cu: "Cuba", cw: "Curaçao", cy: "Cyprus", cz: "Czechia", dk: "Denmark", dj: "Djibouti", dm: "Dominica", do: "Dominican Republic",
  ec: "Ecuador", eg: "Egypt", sv: "El Salvador", gq: "Equatorial Guinea", er: "Eritrea", ee: "Estonia", sz: "Eswatini", et: "Ethiopia",
  fk: "Falkland Islands", fo: "Faroe Islands", fj: "Fiji", fi: "Finland", fr: "France", gf: "French Guiana", pf: "French Polynesia", tf: "French Southern Territories",
  ga: "Gabon", gm: "Gambia", ge: "Georgia", de: "Germany", gh: "Ghana", gi: "Gibraltar", gr: "Greece", gl: "Greenland",
  gd: "Grenada", gp: "Guadeloupe", gu: "Guam", gt: "Guatemala", gg: "Guernsey", gn: "Guinea", gw: "Guinea-Bissau", gy: "Guyana",
  ht: "Haiti", hm: "Heard Island and McDonald Islands", va: "Vatican", hn: "Honduras", hk: "Hong Kong", hu: "Hungary", is: "Iceland", in: "India",
  id: "Indonesia", ir: "Iran", iq: "Iraq", ie: "Ireland", im: "Isle of Man", il: "Israel", it: "Italy", jm: "Jamaica",
  jp: "Japan", je: "Jersey", jo: "Jordan", kz: "Kazakhstan", ke: "Kenya", ki: "Kiribati", kp: "North Korea", kr: "South Korea",
  kw: "Kuwait", kg: "Kyrgyzstan", la: "Laos", lv: "Latvia", lb: "Lebanon", ls: "Lesotho", lr: "Liberia", ly: "Libya",
  li: "Liechtenstein", lt: "Lithuania", lu: "Luxembourg", mo: "Macao", mg: "Madagascar", mw: "Malawi", my: "Malaysia", mv: "Maldives",
  ml: "Mali", mt: "Malta", mh: "Marshall Islands", mq: "Martinique", mr: "Mauritania", mu: "Mauritius", yt: "Mayotte", mx: "Mexico",
  fm: "Micronesia", md: "Moldova", mc: "Monaco", mn: "Mongolia", me: "Montenegro", ms: "Montserrat", ma: "Morocco", mz: "Mozambique",
  mm: "Myanmar", na: "Namibia", nr: "Nauru", np: "Nepal", nl: "Netherlands", nc: "New Caledonia", nz: "New Zealand", ni: "Nicaragua",
  ne: "Niger", ng: "Nigeria", nu: "Niue", nf: "Norfolk Island", mk: "North Macedonia", mp: "Northern Mariana Islands", no: "Norway", om: "Oman",
  pk: "Pakistan", pw: "Palau", ps: "Palestine", pa: "Panama", pg: "Papua New Guinea", py: "Paraguay", pe: "Peru", ph: "Philippines",
  pn: "Pitcairn", pl: "Poland", pt: "Portugal", pr: "Puerto Rico", qa: "Qatar", re: "Réunion", ro: "Romania", ru: "Russia",
  rw: "Rwanda", bl: "Saint Barthélemy", sh: "Saint Helena, Ascension and Tristan da Cunha", kn: "Saint Kitts and Nevis", lc: "Saint Lucia", mf: "Saint Martin", pm: "Saint Pierre and Miquelon", vc: "Saint Vincent and the Grenadines",
  ws: "Samoa", sm: "San Marino", st: "Sao Tome and Principe", sa: "Saudi Arabia", sn: "Senegal", rs: "Serbia", sc: "Seychelles", sl: "Sierra Leone",
  sg: "Singapore", sx: "Sint Maarten", sk: "Slovakia", si: "Slovenia", sb: "Solomon Islands", so: "Somalia", za: "South Africa", gs: "South Georgia and the South Sandwich Islands",
  ss: "South Sudan", es: "Spain", lk: "Sri Lanka", sd: "Sudan", sr: "Suriname", sj: "Svalbard and Jan Mayen", se: "Sweden", ch: "Switzerland",
  sy: "Syria", tw: "Taiwan",
  xk: "Kosovo",
  tj: "Tajikistan", tz: "Tanzania", th: "Thailand", tl: "Timor-Leste", tg: "Togo", tk: "Tokelau",
  to: "Tonga", tt: "Trinidad and Tobago", tn: "Tunisia", tr: "Turkey", tm: "Turkmenistan", tc: "Turks and Caicos Islands", tv: "Tuvalu", ug: "Uganda",
  ua: "Ukraine", ae: "United Arab Emirates", gb: "United Kingdom", us: "United States", um: "United States Minor Outlying Islands", uy: "Uruguay", uz: "Uzbekistan", vu: "Vanuatu",
  ve: "Venezuela", vn: "Vietnam", vg: "Virgin Islands (British)", vi: "Virgin Islands (U.S.)", wf: "Wallis and Futuna", eh: "Western Sahara", ye: "Yemen", zm: "Zambia", zw: "Zimbabwe"
};

/**
 * Derive a user-friendly country label for city questions.
 * Handles ISO-2 ("AZ"), ISO-3 ("SYR"), and special cases like "-99" (e.g., Kosovo in some datasets).
 */
function getCountryLabelFromQuestion(q: any, rawCountry: any): string {
  // 1) If we already have a readable name, keep it
  if (typeof rawCountry === "string" && rawCountry.trim().length > 2 && rawCountry !== "-99") {
    return rawCountry.trim();
  }

  // 2) ISO-2 like "AZ", "SY"
  if (typeof rawCountry === "string" && rawCountry.trim().length === 2 && rawCountry !== "-99") {
    const a2 = rawCountry.trim().toLowerCase();
    return (
      ISO2_TO_NAME[a2] ||
      featureFromIso2(a2)?.properties?.NAME ||
      featureFromIso2(a2)?.properties?.name ||
      featureFromIso2(a2)?.properties?.ADMIN ||
      rawCountry
    );
  }

  // 3) ISO-3 like "SYR"; translate to A2 then name
  if (typeof rawCountry === "string" && rawCountry.trim().length === 3) {
    const a3 = rawCountry.trim().toUpperCase();
    const a2 = ISO3_TO_ISO2[a3];
    if (a2) {
      const a2lc = a2.toLowerCase();
      return (
        ISO2_TO_NAME[a2lc] ||
        featureFromIso2(a2lc)?.properties?.NAME ||
        featureFromIso2(a2lc)?.properties?.name ||
        featureFromIso2(a2lc)?.properties?.ADMIN ||
        rawCountry
      );
    }
  }

  // 4) "-99" and other unknowns. Try the richer fields the generator may have added.
  //    Many Natural Earth rows use WB_A2 = "-99" for disputed / special territories (e.g., Kosovo / XK).
  if (rawCountry === "-99" || rawCountry == null || rawCountry === "") {
    // Prefer explicit names if present
    if (typeof q?.countryName === "string" && q.countryName.trim()) return q.countryName.trim();
    if (typeof q?.adm0name === "string" && q.adm0name.trim()) return q.adm0name.trim();

    // Try ISO-3 on the question, if present
    const maybeA3 = (q?.iso3 || q?.adm0_a3 || q?.ADM0_A3 || q?.featureId);
    if (typeof maybeA3 === "string" && maybeA3.length === 3) {
      const a2 = ISO3_TO_ISO2[maybeA3.toUpperCase()];
      if (a2) {
        const a2lc = a2.toLowerCase();
        return (
          ISO2_TO_NAME[a2lc] ||
          featureFromIso2(a2lc)?.properties?.NAME ||
          featureFromIso2(a2lc)?.properties?.name ||
          featureFromIso2(a2lc)?.properties?.ADMIN ||
          "Kosovo" // sensible default for Pristina-type cases
        );
      }
    }

    // Last-ditch: if the city name hints (e.g., Pristina), offer a conservative default
    if (typeof q?.name === "string" && /pristina/i.test(q.name)) return "Kosovo";
    return typeof rawCountry === "string" ? rawCountry : "";
  }

  // 5) Give up – return as-is
  return typeof rawCountry === "string" ? rawCountry : "";
}

/**
 * Humanize a country suffix given an ISO2 code (2-letter), e.g. "us" → "United States"
 * Returns the country name, or the original code if not found.
 */
function humanizeCountrySuffix(iso2: string): string {
  if (!iso2 || typeof iso2 !== "string") return iso2;
  const key = iso2.trim().toLowerCase();
  return ISO2_TO_NAME[key] || iso2;
}

// Minimal fallback when Natural Earth lacks ISO_A2 on features
// --- Fallback centroids for tiny countries missing at 110m scale ---
// Only used if a polygon isn't present at this scale.
const COUNTRY_CENTROID_OVERRIDES: Record<string, { lng: number; lat: number }> = {
  bb: { lng: -59.543198, lat: 13.1939 }, // Barbados
  mt: { lng: 14.3754,    lat: 35.9375 }, // Malta
  mv: { lng: 73.5361,    lat: 4.1755  }, // Maldives
  ki: { lng: -157.3768,  lat: 1.8709  }, // Kiribati
  to: { lng: -175.1982,  lat: -21.1394}, // Tonga
  tv: { lng: 179.194,    lat: -8.5172 }, // Tuvalu
  ws: { lng: -171.7514,  lat: -13.759 }, // Samoa
  va: { lng: 12.4534,    lat: 41.9029 }, // Vatican City
  mc: { lng: 7.4246,     lat: 43.7384 }, // Monaco
  sm: { lng: 12.4578,    lat: 43.9424 }, // San Marino
  li: { lng: 9.5554,     lat: 47.166  }, // Liechtenstein
  ad: { lng: 1.5211,     lat: 42.5063 }, // Andorra
  lc: { lng: -60.9789,   lat: 13.9094 }, // Saint Lucia
  vc: { lng: -61.2872,   lat: 12.9843 }, // St Vincent & the Grenadines
  ag: { lng: -61.843,    lat: 17.1274 }, // Antigua and Barbuda
  dm: { lng: -61.387,    lat: 15.301  }, // Dominica
  kn: { lng: -62.728,    lat: 17.3026 }, // Saint Kitts and Nevis
  gd: { lng: -61.7486,   lat: 12.0561 }, // Grenada
  cv: { lng: -23.6052,   lat: 15.1111 }, // Cabo Verde
  st: { lng: 6.7273,     lat: 0.1864  }, // Sao Tome and Principe
  sc: { lng: 55.4513,    lat: -4.6192 }, // Seychelles
  mu: { lng: 57.5522,    lat: -20.1609}, // Mauritius
  km: { lng: 43.8722,    lat: -11.7022}, // Comoros
  je: { lng: -2.13125,  lat: 49.21444 }, // Jersey (approx St Helier)
  gg: { lng: -2.58528,  lat: 49.45544 }, // Guernsey (approx St Peter Port)
  im: { lng: -4.48333,  lat: 54.15000 }, // Isle of Man (Douglas)
  gi: { lng: -5.35360,  lat: 36.14080 }, // Gibraltar
};

function centroidFromIso2(iso2?: string) {
  if (!iso2) return null;
  const key = iso2.toLowerCase();
  return COUNTRY_CENTROID_OVERRIDES[key] ?? null;
}

const ISO3_TO_ISO2: Record<string, string> = {
  // Europe
  ALB: "al", AND: "ad", AUT: "at", BEL: "be", BGR: "bg", BIH: "ba", BLR: "by", CHE: "ch",
  CYP: "cy", CZE: "cz", DEU: "de", DNK: "dk", ESP: "es", EST: "ee", FIN: "fi", FRA: "fr",
  GBR: "gb", GRC: "gr", HRV: "hr", HUN: "hu", IRL: "ie", ISL: "is", ITA: "it", LTU: "lt",
  LUX: "lu", LVA: "lv", MCO: "mc", MDA: "md", MKD: "mk", MLT: "mt", MNE: "me", NLD: "nl",
  NOR: "no", POL: "pl", PRT: "pt", ROU: "ro", RUS: "ru", SRB: "rs", SVK: "sk", SVN: "si",
  SWE: "se", UKR: "ua", VAT: "va",
  // Americas
  ARG: "ar", BOL: "bo", BRA: "br", CAN: "ca", CHL: "cl", COL: "co", CRI: "cr", CUB: "cu",
  DOM: "do", ECU: "ec", GTM: "gt", HND: "hn", HTI: "ht", JAM: "jm", MEX: "mx", NIC: "ni",
  PAN: "pa", PER: "pe", PRY: "py", SLV: "sv", URY: "uy", USA: "us", VEN: "ve",
  // Fixes for missing countries used by flags
  BRB: "bb",  // Barbados
  BHS: "bs",  // Bahamas
  // Africa
  DZA: "dz", AGO: "ao", BFA: "bf", BDI: "bi", BEN: "bj", BWA: "bw", CAF: "cf", CIV: "ci",
  CMR: "cm", COD: "cd", COG: "cg", COM: "km", CPV: "cv", DJI: "dj", EGY: "eg", ERI: "er",
  ETH: "et", GAB: "ga", GHA: "gh", GIN: "gn", GMB: "gm", GNB: "gw", GNQ: "gq", KEN: "ke",
  LBR: "lr", LBY: "ly", LSO: "ls", MAR: "ma", MDG: "mg", MLI: "ml", MOZ: "mz", MRT: "mr",
  MUS: "mu", MWI: "mw", NAM: "na", NER: "ne", NGA: "ng", RWA: "rw", SDN: "sd", SEN: "sn",
  SLE: "sl", SOM: "so", SSD: "ss", SWZ: "sz", TCD: "td", TGO: "tg", TUN: "tn", TZA: "tz",
  UGA: "ug", ZAF: "za", ZMB: "zm", ZWE: "zw",
  // Asia
  AFG: "af", ARE: "ae", ARM: "am", AZE: "az", BGD: "bd", BHR: "bh", BRN: "bn", BTN: "bt",
  CHN: "cn", IDN: "id", IND: "in", IRN: "ir", IRQ: "iq", ISR: "il", JOR: "jo", JPN: "jp",
  KAZ: "kz", KHM: "kh", KWT: "kw", LAO: "la", LBN: "lb", LKA: "lk", MDV: "mv", MMR: "mm",
  MNG: "mn", MYS: "my", NPL: "np", OMN: "om", PAK: "pk", PHL: "ph",
  KOR: "kr", // South Korea
  PRK: "kp", // North Korea
  QAT: "qa",
  SAU: "sa", SGP: "sg", SYR: "sy", THA: "th", TJK: "tj", TKM: "tm", TLS: "tl", TUR: "tr",
  TWN: "tw", UZB: "uz", VNM: "vn", YEM: "ye",
  // Oceania
  AUS: "au", FJI: "fj", KIR: "ki", NZL: "nz", PNG: "pg", SLB: "sb", TON: "to", TUV: "tv",
  VUT: "vu", WSM: "ws",
};

/** Reverse lookup: ISO-2 -> ISO-3 (keys lowercased) */
const ISO2_TO_ISO3: Record<string, string> = Object.fromEntries(
  Object.entries(ISO3_TO_ISO2).map(([a3, a2]) => [String(a2).toLowerCase(), String(a3).toUpperCase()])
);

/** Try to pull ISO-2 from various flag question shapes, including id suffixes */
function extractIso2FromQuestion(q: any): string | undefined {
  // 1) Explicit field wins
  if (q && typeof q.iso2 === "string" && q.iso2.length === 2) {
    return String(q.iso2).toLowerCase();
  }
  // 2) Some questions store ISO2 in name (e.g., "AF")
  if (q && typeof q.name === "string" && q.name.length === 2) {
    return String(q.name).toLowerCase();
  }
  // 3) Image path: "flags/af.png"
  if (q && typeof q.image === "string") {
    const m = q.image.match(/flags\/([a-z]{2})\.[a-z]+$/i);
    if (m) return m[1].toLowerCase();
  }
  // 4) ID suffix: country:je, flag:je, flag:whatever:je → take last segment if 2 letters
  if (q && typeof q.id === "string") {
    const parts = q.id.split(":").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /^[a-z]{2}$/i.test(last)) return last.toLowerCase();
  }
  return undefined;
}

/**
 * Use ISO-2 to locate a Natural Earth feature.
 * 1) Try ISO-A2 properties on the feature.
 * 2) Fallback: derive ISO-3 and match against the feature id (NE uses ISO-3 in `id`).
 */
function featureFromIso2(iso2: string): CountryFeature | null {
  const key = String(iso2).toLowerCase();

  // 1) Try ISO-A2 properties on the feature
  let hit =
    COUNTRY_FEATURES.find((f) => {
      const p = f.properties || {};
      const a2eh = typeof p.ISO_A2_EH === "string" ? p.ISO_A2_EH.toLowerCase() : "";
      const a2   = typeof p.ISO_A2 === "string"    ? p.ISO_A2.toLowerCase()    : "";
      const wb2  = typeof p.WB_A2 === "string"     ? p.WB_A2.toLowerCase()     : "";
      return a2eh === key || a2 === key || wb2 === key;
    }) ?? null;

  if (hit) return hit;

  // 2) Fallback: derive ISO-3 and match against the feature id (NE uses ISO-3 in `id`)
  const a3 = ISO2_TO_ISO3[key];
  if (a3) {
    hit = COUNTRY_FEATURES.find((f) => String(f.id || "").toUpperCase() === a3) ?? null;
    if (hit) return hit;
  }

  // Second try: match against ADM0_A3 if present
  if (a3 && !hit) {
    hit = COUNTRY_FEATURES.find((f) => {
      const p = f.properties || {};
      return String(p.ADM0_A3 || "").toUpperCase() === a3;
    }) ?? null;
    if (hit) return hit;
  }

  // 3) Final fallback by English name if we can infer one from ISO-2
  const byName = ISO2_TO_NAME[key];
  if (byName) {
    const nk = normKey(byName);
    hit =
      COUNTRY_FEATURES.find((f) => {
        const p = f.properties || {};
        const nm = p.NAME || p.name || p.ADMIN || "";
        return normKey(String(nm)) === nk;
      }) ?? null;
    if (hit) return hit;
  }

  return null;
}

// ---------- WebView HTML (MapLibre) ----------
const HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="initial-scale=1,width=device-width" />
<link href="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.css" rel="stylesheet" />
<style>
  html,body,#map{height:100%;margin:0;background:#0c1320;}
  .pin,.target{width:16px;height:16px;border-radius:50%;border:2px solid white;position:absolute;pointer-events:none;transform:translate(-50%,-50%);box-shadow:0 2px 6px rgba(0,0,0,0.45);}
  .pin{background:#e53935;z-index:3;}
  .target{background:#1e88e5;z-index:3;}
  .target::after{content:"";position:absolute;left:50%;top:50%;width:16px;height:16px;border-radius:50%;transform:translate(-50%,-50%);background:rgba(30,136,229,0.25);animation:pulse 2s infinite;}
  @keyframes pulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.7;}70%{transform:translate(-50%,-50%) scale(2.3);opacity:0;}100%{transform:translate(-50%,-50%) scale(2.3);opacity:0;}}

  .badge{position:absolute;transform:translate(-50%,calc(-100% - 8px));transform-origin:center;padding:10px 16px;border-radius:16px;font:700 16px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:rgba(10,15,25,0.9);backdrop-filter:blur(5px);color:#fff;border:1px solid rgba(255,255,255,0.15);pointer-events:none;white-space:nowrap;z-index:4;box-shadow:0 4px 12px rgba(0,0,0,0.4);opacity:0;transition:opacity .4s ease,transform .4s ease;text-shadow:-1px -1px 0 rgba(0,0,0,0.25), 1px -1px 0 rgba(0,0,0,0.25), -1px 1px 0 rgba(0,0,0,0.25), 1px 1px 0 rgba(0,0,0,0.25);}
  .badge .answer{font-weight:800;font-size:14px;margin-bottom:6px;color:#fff;opacity:.95}
  .badge .divider{height:1px;width:100%;background:rgba(255,255,255,0.15);margin:4px 0 6px}
  .badge .km{font-weight:700;font-size:14px;color:#cfe3ff}
  .badge .km.perfect{background:transparent;color:#222}
  .badge.below{transform:translate(-50%,8px);}
  .badge.perfect{
    background:linear-gradient(135deg,#ffcc33,#ff9933);
    color:#fff;
    font-weight:800;
    box-shadow:0 0 12px rgba(255,204,51,.5);
  }
  canvas#line{position:absolute;top:0;left:0;pointer-events:none;z-index:2;}
</style>
</head>
<body>
  <div id="map"></div>
  <div id="pin" class="pin" style="display:none;"></div>
  <div id="target" class="target" style="display:none;"></div>
  <div id="badge" class="badge">0 km</div>
  <canvas id="line"></canvas>

  <script src="https://unpkg.com/@turf/turf@6.5.0/turf.min.js"></script>
  <script src="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.js"></script>
  <script>
    const map = new maplibregl.Map({
      container: "map",
      style: "https://demotiles.maplibre.org/style.json",
      center: [0,20],
      zoom: 1.45,
      attributionControl: false
    });

    const pin = document.getElementById("pin");
    const target = document.getElementById("target");
    const badge = document.getElementById("badge");
    const canvas = document.getElementById("line");
    const ctx = canvas.getContext("2d");

     function escapeHtml(s){
  return String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

    window.__mode = "point";
    window.__feature = null;
    window.__lastGuess = null;
    window.kmText = "";

    function project(lng,lat){return map.project({lng,lat});}
    function placeDot(el,lng,lat){
      const p=project(lng,lat);
      el.style.left=p.x+"px"; el.style.top=p.y+"px";
      el.style.display="block"; el.dataset.lng=lng; el.dataset.lat=lat;
    }
    function resizeCanvas(){
      const c=map.getContainer();
      canvas.width=c.clientWidth; canvas.height=c.clientHeight;
    }

  function placeBadgeSmart(lng,lat,text,isPerfect=false){
  const p=project(lng,lat);
  const answer = (window.answerText||"").toString();
  const kmTxt = (window.kmText||"").toString();

  const kmHtml = '<div class="km ' + (isPerfect ? 'perfect' : '') + '\">' + escapeHtml(kmTxt) + '</div>';
  const html = answer
    ? '<div class="answer">' + escapeHtml(answer) + '</div><div class="divider"></div>' + kmHtml
    : kmHtml;

  badge.innerHTML = html;
  badge.style.display="block"; badge.style.opacity="1";
  badge.classList.add("visible");

  const w=badge.offsetWidth||100, h=badge.offsetHeight||28;
  const c=map.getContainer();
  const W=c.clientWidth, H=c.clientHeight, pad=8;

  let anchorBelow=false;
  const spaceAbove=p.y-h-6, spaceBelow=H-(p.y+6+h);
  if(spaceAbove<pad && spaceBelow>spaceAbove) anchorBelow=true;

  const minX=pad+w/2, maxX=W-pad-w/2;
  const clampedX=Math.max(minX, Math.min(maxX, p.x));

  const minY=pad+(anchorBelow?6:h+6), maxY=H-pad-(anchorBelow?h+6:6);
  const clampedY=Math.max(minY, Math.min(maxY, p.y));

  badge.classList.toggle("below", anchorBelow);
  badge.style.left=clampedX+"px"; badge.style.top=clampedY+"px";
}

    function playDing(){
      try{
        const ac=new (window.AudioContext||window.webkitAudioContext)();
        const o=ac.createOscillator(), g=ac.createGain();
        o.type="sine"; o.frequency.value=880; o.connect(g); g.connect(ac.destination);
        const t=ac.currentTime;
        g.gain.setValueAtTime(0.0001,t);
        g.gain.exponentialRampToValueAtTime(0.2,t+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
        o.start(t); o.stop(t+0.24);
      }catch{}
    }

    function redraw(){
      resizeCanvas();
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if(pin.dataset.lng) placeDot(pin, parseFloat(pin.dataset.lng), parseFloat(pin.dataset.lat));
      if(target.dataset.lng) placeDot(target, parseFloat(target.dataset.lng), parseFloat(target.dataset.lat));
      if(window.kmText!=="⭐ Perfect!" && pin.dataset.lng && target.dataset.lng){
        const p1=project(parseFloat(pin.dataset.lng),parseFloat(pin.dataset.lat));
        const p2=project(parseFloat(target.dataset.lng),parseFloat(target.dataset.lat));
        const grad=ctx.createLinearGradient(p1.x,p1.y,p2.x,p2.y);
        grad.addColorStop(0,"#e53935"); grad.addColorStop(1,"#1e88e5");
        ctx.lineWidth=4; ctx.strokeStyle=grad; ctx.globalAlpha=.95;
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke(); ctx.globalAlpha=1;
      }
      if (badge.style.display!=="none" && target.dataset.lng && window.kmText){
        const isPerfect = window.kmText==="⭐ Perfect!";
        placeBadgeSmart(parseFloat(target.dataset.lng), parseFloat(target.dataset.lat), window.kmText, isPerfect);
      }
    }

map.on("load", () => {
  try {
    const layers = map.getStyle().layers || [];
    layers.forEach((l) => {
      const id = l.id.toLowerCase();

      if (l.type === "background") {
        map.setPaintProperty(l.id, "background-color", "#0c1320");
      }

      if (
        l.type === "fill" &&
        (id.includes("water") || id.includes("ocean") || id.includes("sea"))
      ) {
        map.setPaintProperty(l.id, "fill-color", "#143059");
        map.setPaintProperty(l.id, "fill-opacity", 1);
      }

      if (
        l.type === "fill" &&
        !id.includes("water") &&
        !id.includes("ocean") &&
        !id.includes("sea") &&
        !id.includes("glacier")
      ) {
        map.setPaintProperty(l.id, "fill-color", "#1a472a");
        map.setPaintProperty(l.id, "fill-opacity", 0.5);
      }

      if (l.type === "line" && id.includes("admin-0")) {
        map.setPaintProperty(l.id, "line-color", "#ffffff");
        map.setPaintProperty(l.id, "line-width", 1.5);
      }

      if (l.type === "symbol" || l.type === "text" || id.includes("label")) {
        map.setLayoutProperty(l.id, "visibility", "none");
      }
    });
  } catch (e) {
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({ type: "js-error", error: String(e) })
    );
  }
  redraw();
});

    map.on("move", redraw);
    map.on("resize", redraw);

    function handleTap(lng, lat){
      placeDot(pin, lng, lat);
      window.__lastGuess = { lng, lat };

      if (window.__mode === "poly" && window.__feature) {
        try {
          const pt = turf.point([lng, lat]);
          const inside = turf.booleanPointInPolygon(pt, window.__feature);

          let km = 0;
          let snapLng = lng;
          let snapLat = lat;

          if (!inside) {
            const border = turf.polygonToLine(window.__feature);
            const snap = turf.nearestPointOnLine(border, pt, { units: "kilometers" });
            snapLng = snap.geometry.coordinates[0];
            snapLat = snap.geometry.coordinates[1];
            km = turf.distance(pt, snap, { units: "kilometers" });
          }

          window.__lastSnap = { lng: snapLng, lat: snapLat };

          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: "poly-evaluated",
            km: Math.round(km),
            snap: { lng: snapLng, lat: snapLat },
            inside
          }));
        } catch (err) {}
      } else {
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "tap", lng, lat }));
      }

      redraw();
    }

    // Mouse/desktop clicks
    map.on("click", e => {
      const { lng, lat } = e.lngLat;
      handleTap(lng, lat);
    });

    // MapLibre touch event (some platforms)
    map.on("touchend", (e) => {
      try {
        const pt = Array.isArray(e.points) && e.points[0] ? e.points[0] : null;
        if (!pt) return;
        const lngLat = map.unproject([pt.x, pt.y]);
        handleTap(lngLat.lng, lngLat.lat);
      } catch {}
    });

    // Pointer API (Android/iOS WebView often prefers this)
    map.getCanvas().addEventListener("pointerup", (ev) => {
      try{
        const rect = map.getCanvas().getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        const lngLat = map.unproject([x, y]);
        handleTap(lngLat.lng, lngLat.lat);
      }catch{}
    }, { passive: true });

    // iOS/Android WebView: synthesize clicks from touchend
    map.getCanvas().addEventListener("touchend", (ev) => {
      try{
        const t = ev.changedTouches && ev.changedTouches[0];
        if (!t) return;
        const rect = map.getCanvas().getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        const lngLat = map.unproject([x, y]);
        handleTap(lngLat.lng, lngLat.lat);
      }catch{}
    }, { passive: true });

    window.receiveFromRN = function(payload){
      try{
        const msg = (typeof payload === "string") ? JSON.parse(payload) : payload;
        if (!msg) return;

        if (msg.type === "set-view"){
  try{
    var c = Array.isArray(msg.center) ? msg.center : [0,20];
    var z = (typeof msg.zoom === 'number') ? msg.zoom : 2;
    map.easeTo({ center: { lng: c[0], lat: c[1] }, zoom: z, duration: 250 });
  }catch{}
  return;
}

        if (msg.type === "set-point"){ 
          window.__mode = "point"; 
          window.__feature = null; 
          // ensure pin/target are hidden and state is clean
          try { pin.style.display = "none"; } catch {}
          try { target.style.display = "none"; } catch {}
          window.__lastGuess = null;
          window.__lastSnap = null;
          window.kmText = "";
          return; 
        }

        if (msg.type === "set-poly"){ 
          window.__mode = "poly";  
          window.__feature = msg.feature; 
          return; 
        }

        if (msg.type === "reset-poly"){
          pin.style.display = "none";
          target.style.display = "none";
          badge.classList.remove("visible");
          badge.style.opacity = "0";
          ctx.clearRect(0,0,canvas.width,canvas.height);
          window.kmText = "";
          return;
        }

        if (msg.type === "reveal") {
          let lng = msg.target?.lng, lat = msg.target?.lat;

          if ((lng == null || lat == null) && window.__lastSnap) {
            lng = window.__lastSnap.lng;
            lat = window.__lastSnap.lat;
          }

          if ((lng == null || lat == null) && window.__feature) {
            try {
              const c = turf.centerOfMass(window.__feature).geometry.coordinates;
              lng = c[0]; 
              lat = c[1];
            } catch {}
          }

          if (lng != null && lat != null) {
            placeDot(target, lng, lat);
            window.answerText = typeof msg.answer === "string" ? msg.answer : "";
            if (typeof msg.km === "number") {
              window.kmText = (msg.km === 0) ? "⭐ Perfect! ⭐" : (msg.km.toLocaleString() + " km");
              placeBadgeSmart(lng, lat, window.kmText, msg.km === 0);
            }

            map.easeTo({ center: [lng, lat], duration: 900, zoom: Math.max(map.getZoom(), 2.2) });
            redraw();
          }
          return;
        }

      }catch(e){
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type:"js-error", error:String(e) }));
      }
    };
  </script>
</body>
</html>
`;

// ---------- component ----------
export default function Question() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateISO = typeof date === "string" && date ? date : todayISO();
  const isToday = dateISO === todayISO();

  // Challenge params
  const { mode, level, targetKm, difficulty, num, topic, count } = useLocalSearchParams<{
    mode?: string;
    level?: string;
    targetKm?: string;
    difficulty?: "easy" | "medium" | "hard";
    num?: string;
    topic?: string; 
    count?: string; 
  }>();

  const isChallenge = mode === "challenge";
  const isPractice  = mode === "practice";
  const targetKmNum = isChallenge ? Math.max(0, Number(targetKm ?? "0")) : 0;
  const roundDesiredCount    = isChallenge ? Math.max(1, Number(num ?? "6"))  : 0;
  const practiceDesiredCount = isPractice  ? Math.max(1, Number(count ?? "10")) : 0;

// Practice map preset chosen from PRACTICE_REGION
const practiceInitialRegion: InitialRegion | undefined =
  isPractice ? PRACTICE_REGION[String(topic ?? "").toLowerCase()] : undefined;

function zoomForRegion(r?: InitialRegion): number {
  if (!r) return 1.8;
  const d = Math.max(r.longitudeDelta, r.latitudeDelta);
  if (d >= 110) return 1.6;
  if (d >= 80)  return 1.8;
  if (d >= 60)  return 2.0;
  if (d >= 40)  return 2.2;
  if (d >= 25)  return 2.5;
  return 2.8;
}

  // Prevent replaying Daily 10 for today: if already played, bounce to Summary
  useEffect(() => {
    if (!isChallenge && !isPractice && isToday) {
      (async () => {
        try {
          const played = (await hasPlayed(dateISO)) || (await getPlayedFlag(dateISO));
          if (played) {
            router.replace(`/(tabs)/summary?date=${dateISO}` as Href);
          }
        } catch {}
      })();
    }
  }, [isChallenge, isToday, dateISO]);

  // --- Challenge helpers ---
  const goToChallengeIntro = (lvl: string) =>
    router.replace({
      pathname: "/challenge/intro",
      params: { level: lvl },
    } as unknown as Href);

  const clearAdvanceTimeout = () => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  };
  const clearIntervalTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const finishChallengeRound = (finalKm: number) => {
    clearAdvanceTimeout();
    clearIntervalTimer();
    setIsRevealing(true);
    isAdvancingRef.current = true;

    const passed = finalKm <= targetKmNum;

    if (passed) {
      // Increment completion count for this level (non-blocking)
      try {
        const lvl = Number(level ?? "1");
        if (Number.isFinite(lvl) && lvl > 0) {
          incrementChallengeLevel(lvl).catch(() => {});
        }
      } catch {}

      const nextLevel = String(Number(level ?? "1") + 1);
      goToChallengeIntro(nextLevel);
    } else {
      Alert.alert(
        "Round failed",
        `You finished with ${finalKm.toLocaleString()} km (target ${targetKmNum.toLocaleString()} km).`,
        [
          { text: "Retry round", onPress: () => goToChallengeIntro(String(level ?? "1")) },
          { text: "Quit", style: "cancel", onPress: () => router.replace("/challenge") },
        ]
      );
    }
  };

  // ---------------- HOOKS ----------------
  const [allQs, setAllQs] = useState<Question[] | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const loaded = await loadQuestions();
        if (mounted) setAllQs(loaded);
      } catch {
        if (mounted) setAllQs([]); // fail-safe
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const webref = useRef<WebView>(null);
  const isAdvancingRef = useRef(false);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [qIndex, setQIndex] = useState(0);
  const [guess, setGuess] = useState<{ lng: number; lat: number } | null>(null);
  const [lastPolyKm, setLastPolyKm] = useState<number | undefined>(undefined);
  const [lastPolySnap, setLastPolySnap] = useState<{ lng: number; lat: number } | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [wvKey, setWvKey] = useState(0);
  const [totalKm, setTotalKm] = useState(0);
  const [results, setResults] = useState<{ id: string; prompt: string; km: number }[]>([]);
  const [roundKm, setRoundKm] = useState(0);

const QUESTIONS = useMemo(() => {
  if (!allQs) return [];

  if (isChallenge) {
    const pool = allQs.filter((q) => q.difficulty === difficulty);
    const seedKey = `${todayISO()}#L${level ?? "1"}#${difficulty ?? "easy"}`;
    return getDailySet(pool, seedKey, roundDesiredCount);
  }

  if (isPractice) {
    const pool = allQs.filter((q) => matchesPracticeTopic(q, topic));
    const seedKey = `practice#${topic ?? "any"}#${Date.now()}`; // intentionally non-deterministic
    return getDailySet(pool, seedKey, practiceDesiredCount || 10);
  }

  // Default: Daily 10
  return getDailySet(allQs, dateISO, 10);
}, [allQs, isChallenge, isPractice, dateISO, level, difficulty, roundDesiredCount, practiceDesiredCount, topic]);

  const hasQs = QUESTIONS.length > 0;
  const q: Question | null = hasQs ? QUESTIONS[qIndex] : null;
  const ready = hasQs && !!q;
  const progress = Math.max(0, Math.min(1, timeLeft / QUESTION_SECONDS));

  const isPointLike = (t: Question["type"], k?: string) =>
    t === "point" || t === "image" || (k ?? "").toLowerCase() === "city";
  const norm = (v: any) => (typeof v === "string" ? v.trim().toUpperCase() : "");

function matchesPracticeTopic(q: Question, t?: string): boolean {
  if (!t) return false;
  const slug = String(t).toLowerCase();
  const qt = qType(q);
  const k  = (q as any)?.kind?.toLowerCase?.() || "";

  if (slug === "countries") return qt === "country";
  if (slug === "flags")     return isFlagQuestion(q);
  if (slug === "capitals")  return k === "capital";
  if (slug === "cities")    return k === "city" || k === "capital" || qt === "city" || (qt === "point" && k === "city");
  if (slug === "states")    return qt === "state" || k === "state";

  // Regions – best-effort using common fields (depends on your generator)
  const region = (
    (q as any)?.region || (q as any)?.continent || (q as any)?.worldRegion || (q as any)?.subregion || ""
  ).toString().toLowerCase();

  if (slug === "region_europe")   return /europe/.test(region);
  if (slug === "region_asia")     return /asia/.test(region);
  if (slug === "region_africa")   return /africa/.test(region);
  if (slug === "region_americas") return /americas|america|north america|south america/.test(region);
  if (slug === "region_oceania")  return /oceania|australia/.test(region);

  return false;
}

  const findFeatureForQuestion = (question: Question) => {
    const t = qType(question);
    const k = (question as any)?.kind?.toLowerCase?.() || "";

    // ---------- Country / Flag: resolve via ISO-2 first, then fallbacks ----------
    if (t === "country" || t === "flag" || t === "flags" || k === "flag") {
      // A) Try to pull ISO-2 from id/name/image quickly
      let iso2 = extractIso2FromQuestion(question);

      // If still missing, try id prefix like country:br or flag:br
      if (!iso2 && typeof (question as any).id === "string") {
        const parts = (question as any).id.split(":").filter(Boolean);
        const last = parts[parts.length - 1];
        if (last && /^[a-z]{2}$/i.test(last)) iso2 = last.toLowerCase();
      }

      if (iso2) {
        const via2 = featureFromIso2(iso2);
        if (via2 && via2.geometry) return via2;
      }

      // B) Try direct English name hit using the richest available label
      const wantRaw =
        (question as any).featureId ||
        (question as any).answer ||
        (question as any).name ||
        (question as any).country ||
        (question as any).countryName ||
        "";
      if (wantRaw) {
        const hit = findCountryFeature(String(wantRaw));
        if (hit && hit.geometry) return hit;
      }

      // C) If we had ISO-2 but featureFromIso2 failed, try ISO-2 -> English name -> feature
      if (iso2) {
        const english = ISO2_TO_NAME[iso2];
        if (english) {
          const viaName = findCountryFeature(english);
          if (viaName && viaName.geometry) return viaName;
        }
      }

      // D) If name looks like ISO-3, translate to ISO-2 and retry
      const maybeA3 = (question as any).name || (question as any).answer || (question as any).featureId;
      if (typeof maybeA3 === "string" && maybeA3.length === 3) {
        const a2 = ISO3_TO_ISO2[maybeA3.toUpperCase()];
        if (a2) {
          const via2b = featureFromIso2(a2.toLowerCase());
          if (via2b && via2b.geometry) return via2b;
        }
      }

      try {
        console.warn("Country feature not found for:", (question as any)?.name ?? (question as any)?.featureId ?? (question as any)?.answer);
      } catch {}
      return null;
    }

    // ---------- US State: look up polygon by code or name ----------
    if (question.type === "state") {
      const want = norm((question as any).featureId || (question as any).stateCode || (question as any).name);
      return (usStates as any).features?.find((f: any) => {
        const p = f.properties || {};
        return (
          norm(p.STUSPS) === want ||
          norm(p.NAME) === want ||
          norm(p.name) === want ||
          norm(f.id) === want
        );
      }) ?? null;
    }

    return null;
  };

  const sendModeToWebView = () => {
    if (!webref.current || !ready || !q) return;

    // Practice: center & zoom to region so users don't need to pan
if (isPractice && practiceInitialRegion) {
  const viewMsg = {
    type: "set-view",
    center: [practiceInitialRegion.longitude, practiceInitialRegion.latitude],
    zoom: zoomForRegion(practiceInitialRegion),
  };
  webref.current.injectJavaScript(`window.receiveFromRN(${JSON.stringify(viewMsg)}); true;`);
}
    // Point-like: raw coordinates or image questions
    if (qType(q) === "point" || qType(q) === "image" || (q as any)?.kind === "city") {
      // Ensure target exists for point-like (city/image) questions
      if (!(q as any).target) {
        const lat = (q as any).lat ?? (q as any).latitude;
        const lng = (q as any).lng ?? (q as any).longitude;
        if (typeof lat === "number" && typeof lng === "number") {
          (q as any).target = { lng, lat };
        }
      }
      webref.current.injectJavaScript(
        `window.receiveFromRN(${JSON.stringify({ type: "set-point" })}); true;`
      );
      return;
    }

    // Country / flag / state = polygon mode
    if (isCountryLikeQuestion(q) || qType(q) === "state") {
      const feat = findFeatureForQuestion(q);
      if (feat && feat.geometry && (feat.geometry.type === "Polygon" || feat.geometry.type === "MultiPolygon")) {
        const dataset = qType(q) === "state" ? "states" : "countries";
        const msg = {
          type: "set-poly",
          dataset,
          data: dataset === "countries" ? countries : usStates,
          feature: feat,
        };
        webref.current.injectJavaScript(
          `window.receiveFromRN(${JSON.stringify(msg)}); true;`
        );
      } else {
        // Fallback to centroid point-mode for tiny countries not present at 110m scale
        const iso2Tried = extractIso2FromQuestion(q);
        const centroid = centroidFromIso2(iso2Tried);
        if (centroid) {
          webref.current.injectJavaScript(
            `window.receiveFromRN(${JSON.stringify({ type: "set-point" })}); true;`
          );
          // Store a synthetic target so the user can drop a pin and score vs the centroid
          (q as any).target = { lng: centroid.lng, lat: centroid.lat };
        } else {
          try {
            const want =
              (q as any).iso2 ||
              (q as any).name ||
              (q as any).answer ||
              (q as any).featureId ||
              (q as any).country ||
              "(unknown)";
            console.warn("[set-poly] Country feature not found.", { want, iso2Tried });
          } catch {}
          // As a last resort, default to point mode (lets the round progress instead of blocking)
          webref.current.injectJavaScript(
            `window.receiveFromRN(${JSON.stringify({ type: "set-point" })}); true;`
          );
        }
      }
      return;
    }

    // Default to point mode if unclassified
    webref.current.injectJavaScript(
      `window.receiveFromRN(${JSON.stringify({ type: "set-point" })}); true;`
    );
  };

  const onAutoSubmit = () => {
    if (!ready || !q) return;
    if (isRevealing || isAdvancingRef.current) return;

    const km = isPointLike(q.type, (q as any).kind)
      ? guess
        ? Math.round(haversineKm(guess, (q as any).target))
        : MAX_DISTANCE_KM
      : typeof lastPolyKm === "number"
      ? lastPolyKm
      : MAX_DISTANCE_KM;

    revealAndAdvance(Math.min(km, MAX_DISTANCE_KM));
  };

  const startQuestionTimer = () => {
    clearIntervalTimer();
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (!ready) return prev;
        if (isRevealing || isAdvancingRef.current) return prev;
        if (prev <= 1) {
          clearIntervalTimer();
          onAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (!ready) return;

    clearAdvanceTimeout();
    clearIntervalTimer();
    isAdvancingRef.current = false;

    setIsRevealing(false);
    setTimeLeft(QUESTION_SECONDS);
    setGuess(null);
    setLastPolyKm(undefined);

    if (isChallenge && qIndex === 0) {
      setRoundKm(0);
    }

    webref.current?.injectJavaScript(
      `window.receiveFromRN(${JSON.stringify({ type: "reset-poly" })}); true;`
    );

    sendModeToWebView();
    startQuestionTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, qIndex]);

  useEffect(() => {
    return () => {
      clearAdvanceTimeout();
      clearIntervalTimer();
    };
  }, []);

  // ---------------- handlers ----------------
  const revealAndAdvance = async (kmRounded: number) => {
    if (!ready || !q) return;
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    if (isPointLike(q.type, (q as any).kind)) {
      webref.current?.injectJavaScript(
        `window.receiveFromRN(${JSON.stringify({
          type: "reveal",
          target: (q as any).target,
          km: kmRounded,
          answer: formatAnswerLabel(q),
        })}); true;`
      );
    } else {
      const target = lastPolySnap ?? null;
      webref.current?.injectJavaScript(
        `window.receiveFromRN(${JSON.stringify({ type: "reveal", target, km: kmRounded, answer: formatAnswerLabel(q) })}); true;`
      );
    }

    if (isChallenge) {
      const newKm = roundKm + kmRounded;
      setRoundKm(newKm);

      if (targetKmNum > 0 && newKm > targetKmNum) {
        setTimeout(() => finishChallengeRound(newKm), 1200);
        return;
      }
    }

    setIsRevealing(true);
    const nextResults = [
      ...results,
      { id: q.id, prompt: formatPrompt(q), km: kmRounded },
    ];

    clearAdvanceTimeout();
    advanceTimeoutRef.current = setTimeout(async () => {
      const nextTotal = totalKm + kmRounded;
      const nextIndex = qIndex + 1;

      if (nextIndex < QUESTIONS.length) {
        setTotalKm(nextTotal);
        setResults(nextResults);
        setQIndex(nextIndex);
        setWvKey((k) => k + 1);
        isAdvancingRef.current = false;
        setIsRevealing(false);
      } else {
        if (isChallenge) {
          const finalKm = roundKm + kmRounded;
          finishChallengeRound(finalKm);
        }     else {
      if (isPractice) {
        try {
          Alert.alert(
            "Practice complete",
            `Total distance: ${(totalKm + kmRounded).toLocaleString()} km`,
            [{ text: "OK", onPress: () => router.replace("/practice" as Href) }]
          );
        } catch {
          router.replace("/practice" as Href);
        }
      } else {
        try {
          // Persist: best-of-day leaderboard + public daily + detailed summary for Summary screen
          const nextTotal = totalKm + kmRounded;
          await addResult(dateISO, nextTotal);
          const deviceId = await getDeviceId();
          await upsertDaily(deviceId, dateISO, nextTotal);
          await saveSummary(dateISO, nextTotal, nextResults);
          // Mark as played locally to hard-stop immediate replays
          await setPlayedFlag(dateISO);
          // Update head-to-head once both sides have played
          await upsertDailyH2HIfBothPlayed(dateISO, nextTotal);
          const resultsParam = encodeURIComponent(JSON.stringify(nextResults));
          router.push({ pathname: "/summary", params: { totalKm: String(nextTotal), results: resultsParam, date: dateISO } } as Href);
        } catch (e) {
          console.warn("Result save failed:", e);
        }
      }
    }
      }
    }, 3000);
  };

  const onConfirm = () => {
    if (!ready || !q) return;
    if (isRevealing || isAdvancingRef.current) return;

    if (isPointLike(q.type, (q as any).kind)) {
      if (!guess) {
        Alert.alert("Place a pin", "Tap the map to drop your guess.");
        return;
      }
      const km = Math.min(Math.round(haversineKm(guess, (q as any).target)), MAX_DISTANCE_KM);
      revealAndAdvance(km);
      return;
    }

    if (typeof lastPolyKm !== "number") {
      Alert.alert("Place a pin", "Tap inside or near the region first.");
      return;
    }
    revealAndAdvance(Math.min(lastPolyKm, MAX_DISTANCE_KM));
  };

  // ---------------- UI ----------------
  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: 56, left: 12, right: 12, zIndex: 10 }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          {/* Question card */}
          <View
            style={{
              flex: 1,
              backgroundColor: COLORS.questionBg,
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 12,
              ...CARD_SHADOW,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 6,
              }}
            >
              Question {ready ? qIndex + 1 : 0} of {ready ? QUESTIONS.length : 0}
            </Text>

            {ready && q?.type === "image" ? (
              <>
                {q.image && (
                  <Image
                    source={asImageSource(q.image)}
                    style={{
                      width: "100%",
                      height: 160,
                      borderRadius: 10,
                      marginBottom: 8,
                    }}
                    resizeMode="cover"
                  />
                )}
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: COLORS.questionText,
                  }}
                >
                  {formatPrompt(q)}
                </Text>
              </>
            ) : ready && isFlagQuestion(q) ? (
              (() => {
                let iso2: string | undefined = extractIso2FromQuestion(q);

                // If still missing, try to derive from the country feature using any usable key
                if (!iso2) {
                  const wantRaw =
                    (q as any).featureId ||
                    (q as any).answer ||
                    (q as any).name ||
                    (q as any).country ||
                    "";
                  let feat: CountryFeature | null = null;
                  if (wantRaw) {
                    feat = findCountryFeature(String(wantRaw)) ?? null;
                    if (!feat && typeof wantRaw === "string" && wantRaw.length === 2) {
                      feat = featureFromIso2(String(wantRaw).toLowerCase());
                    }
                  }
                  const code =
                    feat?.properties?.ISO_A2_EH ||
                    feat?.properties?.ISO_A2 ||
                    undefined;
                  if (code) {
                    iso2 = String(code).toLowerCase();
                  } else if (feat?.id && typeof feat.id === "string") {
                    const viaA3 = ISO3_TO_ISO2[String(feat.id).toUpperCase()];
                    if (viaA3) iso2 = viaA3.toLowerCase();
                  }
                }

                const flagSrc = iso2 ? getFlagSource(iso2) : undefined;

                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {/* Keep a reserved slot so the layout always has room for a flag */}
                    <View
                      style={{
                        width: 72,
                        height: 48,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.35)",
                        backgroundColor: "#0e2236",
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {flagSrc ? (
                        <Image source={flagSrc} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      ) : (
                        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 18 }}>🏳️</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.questionText }}>
                      {formatPrompt(q)}
                    </Text>
                  </View>
                );
              })()
            ) : (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: COLORS.questionText,
                }}
              >
                {ready && q ? formatPrompt(q) : ""}
              </Text>
            )}

            {/* Slim progress bar */}
            <View
              style={{
                height: 6,
                backgroundColor: "#1b2a41",
                borderRadius: 4,
                marginTop: 8,
                overflow: "hidden",
              }}
            >
              <View style={{ flexDirection: "row", width: "100%", height: "100%" }}>
                <View
                  style={{
                    flex: ready ? progress : 0,
                    backgroundColor: COLORS.brand,
                  }}
                />
                <View style={{ flex: ready ? 1 - progress : 1 }} />
              </View>
            </View>

            {/* Challenge progress bar */}
            {isChallenge && (
              <View style={{ marginTop: 8 }}>
                <Text
                  style={{
                    color: "rgba(255,255,255,.9)",
                    fontSize: 12,
                    marginBottom: 6,
                    fontWeight: "700",
                  }}
                >
                  Round progress
                </Text>
                <View
                  style={{
                    height: 12,
                    backgroundColor: "#18243C",
                    borderRadius: 8,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,.06)",
                  }}
                >
                  {(() => {
                    const pct =
                      targetKmNum > 0 ? Math.min(1, roundKm / targetKmNum) : 0;
                    return (
                      <View
                        style={{
                          width: `${pct * 100}%`,
                          height: "100%",
                          backgroundColor:
                            pct < 0.75
                              ? "#1F6FEB"
                              : pct < 1
                              ? "#E6A700"
                              : "#E53935",
                        }}
                      />
                    );
                  })()}
                </View>
                <Text
                  style={{
                    color: "rgba(255,255,255,.85)",
                    marginTop: 6,
                  }}
                >
                  {roundKm.toLocaleString()} / {targetKmNum.toLocaleString()} km
                </Text>
              </View>
            )}
          </View>

          {/* Timer */}
          <View
            style={{
              width: 64,
              height: 64,
              backgroundColor: COLORS.timerBg,
              borderRadius: 32,
              alignItems: "center",
              justifyContent: "center",
              ...CARD_SHADOW,
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: "800", color: COLORS.timerText }}
            >
              {timeLeft}
            </Text>
          </View>
        </View>
      </View>

      {/* Map */}
      <WebView
        key={wvKey}
        ref={webref}
        source={{ html: HTML }}
        onLoadEnd={sendModeToWebView}
        onMessage={(e) => {
          try {
            const msg = JSON.parse((e as any).nativeEvent.data);
            if (msg.type === "tap") setGuess({ lng: msg.lng, lat: msg.lat });
            if (msg.type === "poly-evaluated" && typeof msg.km === "number") {
              setLastPolyKm(msg.km);
              if (
                msg.snap &&
                typeof msg.snap.lng === "number" &&
                typeof msg.snap.lat === "number"
              ) {
                setLastPolySnap({ lng: msg.snap.lng, lat: msg.snap.lat });
              }
            }
            if (msg.type === "js-error")
              console.warn("WebView JS error:", msg.error);
          } catch {}
        }}
        originWhitelist={["*"]}
        cacheEnabled={false}
        allowFileAccess
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        style={{ flex: 1 }}
      />

      {/* Confirm & reveal lock */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          bottom: 34,
          left: 20,
          right: 20,
          zIndex: 10,
        }}
      >
        {isRevealing && (
          <View
            pointerEvents="auto"
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "transparent",
            }}
          />
        )}

        <TouchableOpacity
          onPress={onConfirm}
          disabled={!ready || isRevealing}
          activeOpacity={0.8}
          style={{
            backgroundColor: !ready || isRevealing ? "#888" : COLORS.brand,
            paddingVertical: 16,
            borderRadius: 40,
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
            opacity: isRevealing ? 0.85 : 1,
          }}
        >
          {isRevealing ? (
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
              Revealing…
            </Text>
          ) : (
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
              {ready ? "Confirm" : "Loading…"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}