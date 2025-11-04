// scripts/extractIso2FromFlags.ts
import fs from "node:fs";
import path from "node:path";

// Read app/lib/flags.ts and pull the keys of the exported object
const FLAGS_FILE = path.resolve("lib/flags.ts");
const OUT = path.resolve("app/data/availableIso2.json");

const src = fs.readFileSync(FLAGS_FILE, "utf8");
// very forgiving: matches lines like `us: require(` or `"us": require(`
const iso2s = Array.from(src.matchAll(/["']?([a-z]{2})["']?\s*:/gi)).map(m => m[1].toLowerCase());

// unique + sorted
const set = Array.from(new Set(iso2s)).sort();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(set, null, 2));
console.log(`Wrote ${set.length} ISO2 codes -> ${OUT}`);