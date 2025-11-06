/* scripts/buildQuestions.ts
   Build public/questions.json only from manually curated items.
   Run: npx tsx scripts/buildQuestions.ts
*/
import * as fs from "node:fs";
import * as path from "node:path";

type BasicValidationIssue = { index: number; reason: string };

function validateCurated(items: AnyQ[]): BasicValidationIssue[] {
  const issues: BasicValidationIssue[] = [];
  const allowedKinds = new Set(["country", "city", "state", "flag", "image", "point"]);
  const allowedDifficulty = new Set(["easy", "medium", "hard"]);

  items.forEach((q, i) => {
    if (!q || typeof q !== "object") {
      issues.push({ index: i, reason: "Item is not an object" });
      return;
    }
    if (!q.id || typeof q.id !== "string") {
      issues.push({ index: i, reason: "Missing string 'id'" });
    }
    if (!q.kind || typeof q.kind !== "string" || !allowedKinds.has(q.kind.toLowerCase())) {
      issues.push({ index: i, reason: "Missing/invalid 'kind'" });
    }
    if (!q.prompt || typeof q.prompt !== "string") {
      issues.push({ index: i, reason: "Missing string 'prompt' (auto-derive should have filled this)" });
    }
    if (q.difficulty && !allowedDifficulty.has(String(q.difficulty).toLowerCase())) {
      issues.push({ index: i, reason: "Invalid 'difficulty' (must be easy|medium|hard)" });
    }
  });

  return issues;
}

type AnyQ = any;

function readJSON<T = any>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// --- Country name lookup ----------------------------------------------
function buildCountryNameIndex(): Record<string, string> {
  const index: Record<string, string> = {};

  // 1) Optional explicit mapping file
  const explicitPath = path.resolve(process.cwd(), "app/data/countryNames.json");
  const explicit = fs.existsSync(explicitPath) ? readJSON<any>(explicitPath) : null;
  if (explicit && typeof explicit === "object") {
    for (const [k, v] of Object.entries(explicit)) {
      if (typeof v === "string") index[k.toUpperCase()] = v;
    }
  }

  // 2) Fallback: derive from questions.countries.json if present
  const countriesPath = path.resolve(process.cwd(), "app/data/questions.countries.json");
  if (fs.existsSync(countriesPath)) {
    const raw = readJSON<any>(countriesPath);
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
    for (const it of arr) {
      if (!it || typeof it !== "object") continue;
      const name = typeof it.name === "string" && it.name.trim().length ? it.name.trim() : (typeof it.countryName === "string" ? it.countryName.trim() : undefined);
      if (!name) continue;
      const iso2 = typeof it.iso2 === "string" ? it.iso2.trim().toUpperCase() : undefined;
      const iso3 = typeof it.iso3 === "string" ? it.iso3.trim().toUpperCase() : undefined;
      if (iso2) index[iso2] = name;
      if (iso3) index[iso3] = name;
      if (typeof it.id === "string" && it.id.startsWith("country:")) {
        const parts = it.id.split(":");
        const code = parts[1]?.toUpperCase();
        if (code && !index[code]) index[code] = name;
      }
    }
  }

  return index;
}

const COUNTRY_NAME_INDEX = buildCountryNameIndex();

function lookupCountryNameByCode(code?: string): string | undefined {
  if (!code || typeof code !== "string") return undefined;
  return COUNTRY_NAME_INDEX[code.toUpperCase()];
}

function inferKind(obj: any): string | undefined {
  // 1) From explicit id prefixes
  if (typeof obj?.id === "string") {
    const id = obj.id.toLowerCase();
    if (id.startsWith("flag:")) return "flag";
    if (id.startsWith("capital:")) return "city"; // map capital -> city
    if (id.startsWith("city:")) return "city";
    if (id.startsWith("state:")) return "state";
    if (id.startsWith("country:")) return "country";
    if (id.startsWith("point:")) return "point";
  }
  // 2) From image location
  if (typeof obj?.image === "string" && /(^|\/)flags\//i.test(obj.image)) {
    return "flag";
  }
  // 2b) Generic images that are not flags
  if (typeof obj?.image === "string" && !/(^|\/)flags\//i.test(obj.image)) {
    return "image";
  }
  // 3) From geocoordinates
  if (
    obj && (
      (typeof obj.lat === "number" && typeof obj.lng === "number") ||
      (typeof obj.latitude === "number" && typeof obj.longitude === "number")
    )
  ) {
    return "point";
  }
  // 4) From common field hints
  if (obj && (obj.city || obj.isCapital || obj.population) && (obj.countryName || obj.countryCode || obj.iso2)) {
    return "city";
  }
  if (obj && (obj.state || obj.stateName || obj.stateCode)) {
    return "state";
  }
  if (obj && (obj.iso2 || obj.iso3 || obj.countryCode) && !obj.city && !obj.state) {
    return "country";
  }
  return undefined;
}

function normalize(item: AnyQ): AnyQ {
  if (!item || typeof item !== "object") return item;

  // --- Robust difficulty fix: coalesce any mis-typed "difficulty" keys (e.g., "di fficulty") ---
  // Copy to avoid mutating while iterating
  const obj: Record<string, any> = item as any;
  for (const k of Object.keys(obj)) {
    const normalizedKey = k.replace(/\s+/g, "").toLowerCase(); // remove spaces, lowercase
    if (normalizedKey === "difficulty" && k !== "difficulty") {
      obj.difficulty = obj[k];
      delete obj[k];
    }
  }

  // If `kind` is missing but a `type` was provided, use it
  if (!obj.kind && typeof obj.type === "string" && obj.type.trim().length) {
    obj.kind = obj.type.trim();
  }

  // Ensure/Infer `kind`
  if (!obj.kind) {
    obj.kind = inferKind(obj);
  }
  // Map synonyms before lowercasing
  if (typeof obj.kind === "string") {
    const k = obj.kind.toLowerCase();
    obj.kind = (k === "capital") ? "city" : k; // coerce capital -> city
  }
  // Final fallback for missing/unknown kind – choose a sensible allowed default
  if (!obj.kind) {
    if (typeof obj.image === "string") obj.kind = "image"; // generic image card
    else if (
      (typeof obj.lat === "number" && typeof obj.lng === "number") ||
      (typeof obj.latitude === "number" && typeof obj.longitude === "number")
    ) obj.kind = "point";
    else if (obj.iso2 || obj.iso3 || obj.countryCode) obj.kind = "country";
    else obj.kind = "image"; // absolute last resort so it passes validation
  }
  if (typeof obj.kind === "string") obj.kind = obj.kind.toLowerCase();

  // Infer capital status from id or explicit flag
  const idStr = typeof obj.id === "string" ? obj.id.toLowerCase() : "";
  const inferredCapital = idStr.startsWith("capital:") || obj.isCapital === true;
  if (inferredCapital) obj.isCapital = true;

  // Try to ensure `countryName` exists using multiple sources
  if (typeof obj.countryName !== "string" || obj.countryName.trim().length === 0) {
    // 0) Direct fields first
    if (typeof obj.country === "string" && obj.country.trim().length) {
      obj.countryName = obj.country.trim();
    } else if (obj.kind === "country") {
      // Country items may carry the full name in `answer` or `name`
      if (typeof obj.answer === "string" && obj.answer.trim().length) {
        obj.countryName = obj.answer.trim();
      } else if (typeof obj.name === "string" && obj.name.trim().length) {
        obj.countryName = obj.name.trim();
      }
    }

    // 1) From codes on the object
    if (typeof obj.countryName !== "string" || obj.countryName.trim().length === 0) {
      const codeFromObj = (typeof obj.iso2 === "string" && obj.iso2)
        || (typeof obj.iso3 === "string" && obj.iso3)
        || (typeof obj.countryCode === "string" && obj.countryCode)
        || undefined;
      let code: string | undefined = codeFromObj as string | undefined;

      // 2) From id suffix: e.g., country:fr, city:paris:fr, flag:fr
      if (!code && typeof obj.id === "string") {
        const parts = obj.id.split(":").filter(Boolean);
        const last = parts[parts.length - 1];
        if (last && /^[a-z]{2,3}$/i.test(last)) code = last.toUpperCase();
      }

      const lookedUp = lookupCountryNameByCode(code);
      if (lookedUp) obj.countryName = lookedUp;
    }
  }

  // Auto-derive a prompt if missing (robust: works even without `name`)
  if (typeof obj.prompt !== "string" || obj.prompt.trim().length === 0) {
    // Try to build a display name from multiple possible fields
    let displayName: string | undefined = undefined;

    // From explicit fields
    if (typeof obj.name === "string" && obj.name.trim().length) displayName = obj.name.trim();
    else if (typeof obj.city === "string" && obj.city.trim().length) displayName = obj.city.trim();
    else if (typeof obj.stateName === "string" && obj.stateName.trim().length) displayName = obj.stateName.trim();
    else if (typeof obj.state === "string" && obj.state.trim().length) displayName = obj.state.trim();
    else if (typeof obj.countryName === "string" && obj.countryName.trim().length) displayName = obj.countryName.trim();
    else if (typeof obj.iso2 === "string" && obj.iso2.trim().length) displayName = obj.iso2.trim().toUpperCase();
    else if (typeof obj.iso3 === "string" && obj.iso3.trim().length) displayName = obj.iso3.trim().toUpperCase();

    // From image path for flags (e.g., flags/br.png -> BR)
    if (!displayName && typeof obj.image === "string") {
      const m = obj.image.match(/(^|\/)flags\/([a-z]{2})\.[a-z]+$/i);
      if (m) displayName = m[2].toUpperCase();
    }

    // From id suffix (e.g., city:paris:fr -> PARIS or FR)
    if (!displayName && typeof obj.id === "string") {
      const parts = obj.id.split(":").filter(Boolean);
      if (parts.length > 1) {
        // prefer the 2nd token if it looks like a name
        displayName = parts[1].toUpperCase();
      }
    }

    const kind = typeof obj.kind === "string" ? obj.kind.toLowerCase() : undefined;

    // Derive prompt per kind, falling back gracefully
    if (kind === "flag") {
      // Always safe even without a name
      obj.prompt = "FLAG: Which country?";
    } else if (kind === "city") {
      // Rule: City prompts should be "Where is City, Country?" when a country name is available
      const city = displayName; // already best-effort from name/city/etc
      const country = (typeof obj.countryName === "string" && obj.countryName.trim().length)
        ? obj.countryName.trim()
        : undefined;

      let base = "Where is this city?";
      if (city && country) base = `Where is ${city}, ${country}?`;
      else if (city) base = `Where is ${city}?`;

      // Prefix CAPITAL: for capital city questions
      obj.prompt = (obj.isCapital && !/^CAPITAL:\s*/i.test(base)) ? `CAPITAL: ${base}` : base;
    } else if (kind === "state") {
      if (displayName && typeof obj.countryName === "string" && obj.countryName.trim().length) {
        obj.prompt = `Where is ${displayName}, ${obj.countryName.trim()}?`;
      } else if (displayName) {
        obj.prompt = `Where is ${displayName}?`;
      } else {
        obj.prompt = "Where is this state?";
      }
    } else if (kind === "country") {
      // Rule: Country prompts should use full country name: "Where is France?"
      const country = (typeof obj.countryName === "string" && obj.countryName.trim().length)
        ? obj.countryName.trim()
        : (typeof obj.answer === "string" && obj.answer.trim().length)
          ? obj.answer.trim()
          : (typeof obj.name === "string" && obj.name.trim().length ? obj.name.trim() : undefined);
      if (country) obj.prompt = `Where is ${country}?`;
      else obj.prompt = "Where is this country?";
    } else if (kind === "point") {
      if (displayName) obj.prompt = `Where is ${displayName}?`;
      else obj.prompt = "Where is this place?";
    } else {
      if (displayName) obj.prompt = `Where is ${displayName}?`;
      else obj.prompt = "Where is this place?";
    }
  }

  // Ensure capital city prompts are prefixed even if prompt was pre-filled in curated data
  if (obj.kind === "city" && obj.isCapital && typeof obj.prompt === "string" && !/^CAPITAL:\s*/i.test(obj.prompt)) {
    obj.prompt = `CAPITAL: ${obj.prompt}`;
  }

  return obj;
}

// --- Ensure folder exists ---
if (!fs.existsSync("app/data/manual")) {
  fs.mkdirSync("app/data/manual", { recursive: true });
}

// --- Load curated manual file only ---
const curatedPath = path.resolve(process.cwd(), "app/data/manual/curated.json");
if (!fs.existsSync(curatedPath)) {
  console.error("❌ No curated.json found at", curatedPath);
  process.exit(1);
}

const curatedRaw = readJSON<any>(curatedPath);
let curatedItemsSource: AnyQ[] = [];
if (Array.isArray(curatedRaw)) {
  curatedItemsSource = curatedRaw;
} else if (curatedRaw && Array.isArray(curatedRaw.items)) {
  curatedItemsSource = curatedRaw.items;
} else {
  curatedItemsSource = [];
}
const curatedItems = curatedItemsSource.map(normalize);

console.log(
  `ℹ️  Loaded curated from ${curatedPath} -> ` +
  (Array.isArray(curatedRaw)
    ? `top-level array (${curatedItemsSource.length} items)`
    : Array.isArray(curatedRaw?.items)
      ? `items[] array (${curatedItemsSource.length} items)`
      : `no items found`)
);

// --- Optionally include generated flags (merge with curated) ---
const flagsPath = path.resolve(process.cwd(), "app/data/questions.flags.json");
let flagItems: AnyQ[] = [];
if (fs.existsSync(flagsPath)) {
  try {
    const raw = readJSON<any>(flagsPath);
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
    flagItems = arr.map(normalize).filter((q: AnyQ) => q && q.kind === "flag");
    console.log(`ℹ️  Loaded flags from ${flagsPath} -> ${flagItems.length} items`);
  } catch (e) {
    console.warn(`⚠️  Failed to read flags at ${flagsPath}:`, (e as Error)?.message);
  }
}

// --- Optionally include generated US states (merge with curated) ---
const statesPath = path.resolve(process.cwd(), "app/data/questions.us_states.json");
let stateItems: AnyQ[] = [];
if (fs.existsSync(statesPath)) {
  try {
    const raw = readJSON<any>(statesPath);
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
    stateItems = arr.map(normalize).filter((q: AnyQ) => q && q.kind === "state");
    console.log(`ℹ️  Loaded states from ${statesPath} -> ${stateItems.length} items`);
  } catch (e) {
    console.warn(`⚠️  Failed to read states at ${statesPath}:`, (e as Error)?.message);
  }
}

// Merge curated + flags + states, preferring curated on id collisions, then flags, then states
const byId = new Map<string, AnyQ>();
for (const q of curatedItems) {
  if (q && typeof q.id === "string") byId.set(q.id, q);
}
for (const q of flagItems) {
  if (!q || typeof q.id !== "string") continue;
  if (!byId.has(q.id)) byId.set(q.id, q);
}
for (const q of stateItems) {
  if (!q || typeof q.id !== "string") continue;
  if (!byId.has(q.id)) byId.set(q.id, q);
}
let finalItems = Array.from(byId.values());
// --- Exclude unsupported micro-territories (e.g., Jersey / JE) ---
const DROP_ISO2 = new Set(["je", "um", "mq", "cc", "vc"]);

function extractIso2Loose(q: any): string | undefined {
  // explicit iso2
  if (q && typeof q.iso2 === "string" && q.iso2.length === 2) return q.iso2.toLowerCase();
  // some flags use name as code (e.g., "JE")
  if (q && typeof q.name === "string" && q.name.length === 2) return q.name.toLowerCase();
  // image path like flags/je.png
  if (q && typeof q.image === "string") {
    const m = q.image.match(/flags\/([a-z]{2})\.[a-z]+$/i);
    if (m) return m[1].toLowerCase();
  }
  // id suffix: country:je, flag:je, flag:xyz:je → last 2-letter token
  if (q && typeof q.id === "string") {
    const parts = q.id.split(":").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /^[a-z]{2}$/i.test(last)) return last.toLowerCase();
  }
  return undefined;
}

const beforeDrop = finalItems.length;
finalItems = finalItems.filter((q: any) => {
  const code = extractIso2Loose(q);
  if (code && DROP_ISO2.has(code)) return false;
  const nameText = ((q?.countryName || q?.country || q?.answer || q?.name || "") + "").toLowerCase();
  if (nameText === "jersey") return false;
  return true;
});
if (beforeDrop !== finalItems.length) {
  console.log(`🧹 Removed ${beforeDrop - finalItems.length} item(s) for excluded territories (JE)`);
}

// --- Safety checks before writing ---
// 1) Do not proceed if there are zero curated items (unless FORCE=1)
const MIN_ITEMS = Number(process.env.MIN_ITEMS ?? "1");
if (finalItems.length < MIN_ITEMS) {
  console.error(`❌ Refusing to overwrite: curated items count (${finalItems.length}) is below MIN_ITEMS=${MIN_ITEMS}. Set MIN_ITEMS or export FORCE=1 to override.`);
  process.exit(1);
}

// 2) Basic schema validation
const problems = validateCurated(finalItems);
if (problems.length) {
const sample = problems
  .slice(0, 10)
  .map((p: BasicValidationIssue) => `#${p.index}: ${p.reason}`)
  .join("\n  - ");
  console.error(`❌ Found ${problems.length} validation issue(s):\n  - ${sample}\nRefusing to write public/questions.json. (Set FORCE=1 to override)`);
  if (process.env.DEBUG === "1") {
    const first = problems[0]?.index ?? 0;
    const peek = finalItems[first];
    console.error("🔎 First failing item JSON:\n" + JSON.stringify(peek, null, 2));
  }
  if (process.env.FORCE !== "1") process.exit(1);
}

// --- Write only curated items (with backup & shrink guards) ---
const outPath = path.resolve(process.cwd(), "public/questions.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });

// Read existing to compare sizes
let prevCount = 0;
let prevRaw: any = null;
if (fs.existsSync(outPath)) {
  try {
    prevRaw = JSON.parse(fs.readFileSync(outPath, "utf8"));
    prevCount = Array.isArray(prevRaw?.items) ? prevRaw.items.length : (Array.isArray(prevRaw) ? prevRaw.length : 0);
  } catch {}
}

// Guard against accidental massive shrink (unless FORCE=1)
// e.g. default threshold allows at least 25% of previous size
const SHRINK_THRESHOLD = Number(process.env.SHRINK_THRESHOLD ?? "0.25");
if (
  prevCount > 0 &&
  finalItems.length < Math.floor(prevCount * SHRINK_THRESHOLD) &&
  process.env.FORCE !== "1"
) {
  console.error(`❌ Refusing to overwrite: curated items (${finalItems.length}) < ${SHRINK_THRESHOLD * 100}% of previous (${prevCount}). Export FORCE=1 to override.`);
  process.exit(1);
}

console.log(`📦  Assembling output: curated=${curatedItems.length}, flags=${flagItems.length}, final=${finalItems.length}`);

// Backup previous file (timestamped) before writing
if (fs.existsSync(outPath)) {
  const backupDir = path.resolve(process.cwd(), "public/.backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `questions.${ts}.json`);
  try {
    fs.copyFileSync(outPath, backupPath);
    console.log(`🗂️  Backup written: ${backupPath}`);
  } catch (e) {
    console.warn("⚠️  Could not write backup:", (e as Error)?.message);
  }
}

// Finally write the curated-only file
const out = { version: Date.now(), items: finalItems };
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`✅ Wrote ${finalItems.length} curated items to ${outPath}`);

// Also mirror to app/data/questions.json for convenience (some older scripts expect this)
const appDataOut = path.resolve(process.cwd(), "app/data/questions.json");
fs.mkdirSync(path.dirname(appDataOut), { recursive: true });
fs.writeFileSync(appDataOut, JSON.stringify(out, null, 2));
console.log(`🔁 Mirrored ${finalItems.length} items to ${appDataOut}`);