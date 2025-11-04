// scripts/generateCityQuestions.ts
import fs from "fs";
import path from "path";

// Load region mapping from app/data/regions.json
const REGIONS_PATH = path.resolve("app/data/regions.json");
let REGIONS: Record<string, string> = {};
try {
  if (fs.existsSync(REGIONS_PATH)) {
    REGIONS = JSON.parse(fs.readFileSync(REGIONS_PATH, "utf8")) as Record<string, string>;
  }
} catch {
  // ignore, we'll default to undefined
}

function regionFor(opts: { iso3?: string; iso2?: string; fallback?: string }) {
  const iso3 = opts.iso3?.toUpperCase();
  const iso2 = opts.iso2?.toUpperCase();
  if (iso3 && REGIONS[iso3]) return REGIONS[iso3];
  if (iso2 && REGIONS[iso2]) return REGIONS[iso2];
  return opts.fallback ?? undefined;
}

// --- ISO helpers (handle "-99" and ISO3→ISO2 fallbacks) ---------------------
const ISO3_TO_ISO2: Record<string, string> = {
  KOS: "XK", // Kosovo (often ISO_A2 is -99)
  PSE: "PS", // Palestine
  SSD: "SS", // South Sudan
};

function normalizeISO2(props: any): { iso2?: string; iso3?: string } {
  const raw2 = (props.ISO_A2 || props.ISO2 || props.iso2 || "").toString();
  const raw3 = (props.ADM0_A3 || props.SOV_A3 || props.ISO_A3 || props.iso3 || "").toString();

  let iso2 = raw2 && raw2 !== "-99" ? raw2.toUpperCase() : "";
  const iso3 = raw3 ? raw3.toUpperCase() : "";

  if (!iso2 && iso3 && ISO3_TO_ISO2[iso3]) {
    iso2 = ISO3_TO_ISO2[iso3];
  }
  return { iso2: iso2 || undefined, iso3: iso3 || undefined };
}

// --- Difficulty helpers -----------------------------------------------------
const EASY_COUNTRIES = new Set(["US","GB","FR","DE","ES","IT","CA","AU",]);
const CAPITAL_FLAGS = new Set(["Admin-0 capital","Admin-1 capital"]); // if you carry FEATURECLA or similar

const EASY_OVERRIDES = new Set<string>([
  // add famous places you want to always be "easy"
  "paris","london","new york","tokyo","mumbai","barcelona","sydney",
]);

const HARD_OVERRIDES = new Set<string>([
  // your call-outs:
  "benin city","incheon","Lanzhou",
]);

function norm(s: string) {
  return s.toLowerCase().trim();
}

function hasDiacritics(s: string) {
  return s.normalize("NFD") !== s.normalize("NFC");
}

function nameFriction(name: string) {
  let p = 0;
  if (hasDiacritics(name)) p += 0.5;                // e.g., “İzmir”, “São Luís”
  if (name.split(/\s+/).length >= 3) p += 0.5;      // very long multi-word
  if (/[^\x00-\x7F]/.test(name)) p += 0.25;         // non-ASCII chars
  return p;
}

function scoreCity(c: {
  name: string;
  countryCode: string;
  population?: number;
  scalerank?: number;
  featurecla?: string; // if present in your data
}) {
  let s = 0;

  // population (diminishing returns)
  const pop = c.population ?? 0;
  if (pop >= 8_000_000) s += 3;
  else if (pop >= 4_000_000) s += 2.5;
  else if (pop >= 2_000_000) s += 2;
  else if (pop >= 1_000_000) s += 1.5;
  else if (pop >= 500_000) s += 1;

  // scalerank (lower = more prominent in Natural Earth)
  const sr = c.scalerank ?? 8;
  if (sr <= 2) s += 3;
  else if (sr <= 4) s += 1.5;
  else if (sr <= 6) s += 0;

  // capitals are generally easier
  if (c.featurecla && CAPITAL_FLAGS.has(c.featurecla)) s += 2.5;

  // globally familiar countries get a small lift
  if (EASY_COUNTRIES.has(c.countryCode)) s += 0.75;

  // name friction (subtract)
  s -= nameFriction(c.name);

  // manual overrides last
  const n = norm(c.name);
  if (EASY_OVERRIDES.has(n)) s = Math.max(s, 6);
  if (HARD_OVERRIDES.has(n)) s = Math.min(s, 2);

  return s;
}

function difficultyFromScore(score: number): "easy"|"medium"|"hard" {
  if (score >= 7) return "easy";
  if (score >= 5)   return "medium";
  return "hard";
}

/** Minimal GeoJSON types */
type Feat = { type: "Feature"; properties: any; geometry: { type: string; coordinates: any } };
type FC = { type: "FeatureCollection"; features: Feat[] };

/** Paths */
const assets = (p: string) => path.resolve(process.cwd(), "assets", p);
const out = (p: string) => path.resolve(process.cwd(), "app/data", p);

/** Helpers */
function readGeoJSON(p: string): FC {
  return JSON.parse(fs.readFileSync(assets(p), "utf8"));
}

// GeoJSON positions are [lon, lat]
function ptCoords(geom: any) {
  if (!geom) return null;
  if (geom.type === "Point") return geom.coordinates;
  if (geom.type === "MultiPoint" && geom.coordinates?.length) return geom.coordinates[0];
  return null;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeRegion(raw?: string) {
  const s = (raw || "").toLowerCase();
  if (!s) return undefined;
  if (s.includes("europe")) return "Europe";
  if (s.includes("asia")) return "Asia";
  if (s.includes("africa")) return "Africa";
  if (s.includes("oceania") || s.includes("austral") || s.includes("australia")) return "Oceania";
  if (s.includes("north america")) return "North America";
  if (s.includes("south america")) return "South America";
  if (s.includes("antarctica")) return "Antarctica";
  return undefined;
}

function toRow(f: Feat, kind: "capital" | "city") {
  const p = f.properties || {};
  const coords = ptCoords(f.geometry);
  if (!coords) return null;

  const name = p.NAME || p.NAMEASCII || p.name || p.city || "Unknown";

  // Normalize ISO codes (handles ISO_A2='-99' via ISO3 fallback)
  const { iso2, iso3 } = normalizeISO2(p);

  const regionRaw = p.CONTINENT || p.REGION_UN || p.region;
  const region = regionFor({ iso2, iso3, fallback: normalizeRegion(regionRaw) });

  const [lon, lat] = coords;
  const population = p.POP_MAX ?? p.POP_MIN ?? p.POP ?? undefined;
  const scalerank = p.SCALERANK ?? undefined;

  // Compute difficulty using the richer scoring model
  const score = scoreCity({
    name,
    countryCode: (iso2 || "").toUpperCase(),
    population: typeof population === "number" ? population : undefined,
    scalerank: typeof scalerank === "number" ? scalerank : undefined,
    featurecla: p.FEATURECLA,
  });
  const diff = difficultyFromScore(score);

  const countryName = p.ADM0NAME || p.SOV0NAME || p.country || undefined;
  const safeIso = (iso2 || "xx").toLowerCase();
  const slug = slugify(name);

  return {
    id: `${kind}:${slug}:${safeIso}`,
    name,
    kind, // "capital" | "city"
    countryCode: iso2 || undefined,
    country: countryName,
    iso2,
    iso3,
    region,
    lat: +lat,
    lng: +lon,
    population,
    scalerank,
    difficulty: diff,
  };
}

function writeJSON(filename: string, data: any[]) {
  const dst = out(filename);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote ${dst} with ${data.length} records`);
}

/** Build capitals list */
const capitals = (readGeoJSON("capitals.geojson").features || [])
  .map((f) => toRow(f, "capital"))
  .filter(Boolean) as any[];

/** Build cities list, skipping duplicates where a capital appears in cities */
const citiesRaw = (readGeoJSON("major_cities.geojson").features || [])
  .map((f) => toRow(f, "city"))
  .filter(Boolean) as any[];

const seen = new Set(capitals.map((c) => c.id));
const cities = citiesRaw.filter((c) => !seen.has(c.id));

writeJSON("questions.capitals.json", capitals);
writeJSON("questions.cities.json", cities);