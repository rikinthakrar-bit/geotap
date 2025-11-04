// scripts/generateFlagQuestions.ts
import fs from "fs";
import path from "path";

const FLAGS_DIR = path.resolve(process.cwd(), "assets/flags");
const OUT = path.resolve(process.cwd(), "app/data/questions.flags.json");

// Optional regions map (ISO2 -> Region)
const REGIONS_PATH = path.resolve(process.cwd(), "app/data/regions.json");
let REGIONS: Record<string, string> = {};
try {
  if (fs.existsSync(REGIONS_PATH)) {
    const raw = fs.readFileSync(REGIONS_PATH, "utf8");
    REGIONS = JSON.parse(raw);
  }
} catch {
  // ignore – regions will simply be omitted
  REGIONS = {};
}
function regionFor(iso2: string): string | undefined {
  const key = iso2.toUpperCase();
  return REGIONS[key];
}

// --- Difficulty policy -------------------------------------------------------
// Easy: G20 sovereign members (ISO2)
const EASY_G20 = new Set([
  "AR","AU","BR","CA","CN","FR","DE","IN","ID","IT",
  "JP","KR","MX","RU","SA","ZA","TR","GB","US"
  // EU is not a country; skip "EU"
]);

// Medium: small curated set that’s very widely recognized but not in G20
const MEDIUM_EXTRA = new Set([
  "ES","NL","SE","NO","CH","NZ","SG","AE","IL","PT","GR",
  "EG","NG","VN","TH","PH","PL","IE","DK","AT","BE"
]);

function difficultyFromIso2(iso2: string): "easy" | "medium" | "hard" {
  const code = iso2.toUpperCase();
  if (EASY_G20.has(code)) return "easy";
  if (MEDIUM_EXTRA.has(code)) return "medium";
  return "hard";
}
// ---------------------------------------------------------------------------

const iso2Regex = /^[a-z]{2}\.(png|jpg|jpeg|webp)$/i;

function toCountryCode(file: string) {
  return path.basename(file).split(".")[0].toUpperCase(); // "jp.png" -> "JP"
}

function main() {
  if (!fs.existsSync(FLAGS_DIR)) {
    throw new Error(`Flags folder not found: ${FLAGS_DIR}`);
  }

  const files = fs
    .readdirSync(FLAGS_DIR)
    .filter((f) => iso2Regex.test(f))
    .sort((a, b) => a.localeCompare(b));

  const records = files.map((file) => {
    const iso2 = toCountryCode(file);
    const difficulty = difficultyFromIso2(iso2);
    const rec: any = {
      id: `flag:${iso2.toLowerCase()}`,
      kind: "flag",
      name: iso2,                     // ISO2 (e.g., "JP")
      image: `flags/${file}`,         // local asset path used by the app
      prompt: "FLAG: Which country?",
      difficulty,
    };
    const region = regionFor(iso2);
    if (region) rec.region = region;
    return rec;
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(records, null, 2), "utf8");
  console.log(`✅ Wrote ${records.length} flag questions to ${OUT}`);
}

main();