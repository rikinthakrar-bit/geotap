// scripts/generateStateQuestions.ts
import fs from "fs";
import path from "path";

type Feat = { type:"Feature"; properties:any; geometry:{type:string; coordinates:any} };
type FC = { type:"FeatureCollection"; features:Feat[] };

const src = path.resolve(process.cwd(), "assets/us-states.json"); // your existing file
const out = path.resolve(process.cwd(), "app/data/questions.us_states.json");
const outPublic = path.resolve(process.cwd(), "public/questions.us_states.json");

const fc:FC = JSON.parse(fs.readFileSync(src,"utf8"));

if (!fc?.features?.length) {
  console.error("No features found in", src);
  process.exit(1);
}

function slugify(s:string){
  return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}

// lightweight centroid (bbox center); good enough for map labels/questions
function bboxCentroid(coords:any): [number, number] {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const visit = (arr:any) => {
    if (typeof arr?.[0] === "number" && typeof arr?.[1] === "number"){
      const [x,y] = arr;
      if (x<minX) minX=x; if (x>maxX) maxX=x;
      if (y<minY) minY=y; if (y>maxY) maxY=y;
      return;
    }
    for (const a of arr) visit(a);
  };
  visit(coords);
  return [ (minX+maxX)/2, (minY+maxY)/2 ];
}

// Heuristic difficulty by recognisability (no borders):
// - EASY: obvious outlines or stand-out locations (AK, HI, FL, TX, CA, MI, LA, ME, etc.)
// - HARD: small NE states and central ‘blocky’ interiors that are tough without borders
// - MEDIUM: everything else
function difficultyForState(name: string): "easy" | "medium" | "hard" {
  const n = name.trim();
  const EASY = new Set<string>([
    "Alaska","Hawaii","Florida","Texas","California","Maine","Michigan","Louisiana",
    "Washington","Oregon","Arizona","New Mexico","Nevada",
    // Big Four Corners & mountain outlines are fairly recognisable from context
    "Utah","Colorado","Idaho","Wyoming","Montana"
  ]);

  const HARD = new Set<string>([
    // Small/Northeast – hard to place without borders
    "Rhode Island","Connecticut","Delaware","New Jersey","Vermont","New Hampshire","Maryland","District of Columbia",
    // Central interior blocky/plains – easily confused
    "Nebraska","Kansas","Iowa","Oklahoma","Arkansas","Missouri","Indiana","Illinois","Kentucky","Tennessee",
    // Upper Midwest can be tricky when lakes aren’t obvious at zoom
    "Wisconsin","Minnesota","North Dakota","South Dakota"
  ]);

  if (EASY.has(n)) return "easy";
  if (HARD.has(n)) return "hard";
  return "medium";
}

const questions = fc.features.map(f=>{
  const name = f.properties?.NAME || f.properties?.name || "Unknown";
  const [lon,lat] = bboxCentroid(f.geometry.coordinates);
  return {
    id: `state:${slugify(name)}`,
    kind: "state",
    type: "state",
    name,
    countryName: "United States",
    countryCode: "US",
    iso2: "US",
    region: "North America",
    lat, lng: lon,
    prompt: `Where is ${name}, United States?`,
    difficulty: difficultyForState(name)
  };
});

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(questions, null, 2), "utf8");

// Also mirror to public for direct app consumption/debug
fs.mkdirSync(path.dirname(outPublic), { recursive: true });
fs.writeFileSync(outPublic, JSON.stringify(questions, null, 2), "utf8");

console.log("Wrote", questions.length, "states →", out);
console.log("Mirrored →", outPublic);