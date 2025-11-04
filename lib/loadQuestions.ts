// lib/loadQuestions.ts
import { getFlagSource } from "./flags";
import type { Question } from "./questions";

// Read the locally bundled, built questions file (produced by your build scripts).
// This should include countries, cities, states, flags, etc.
import localData from "../app/data/questions.json";

/**
 * Resolve an image field to a React Native Image source.
 * Supports:
 *  - require() numbers (already bundled)
 *  - http(s) URLs (as { uri })
 *  - "flags/xx.png" which resolves via getFlagSource
 */
function resolveImage(img: unknown) {
  if (!img) return undefined;

  // Already a bundled asset (require returns a number)
  if (typeof img === "number") return img;

  if (typeof img === "string") {
    // Flags: "flags/xx.png" -> look up via our generated map
    if (img.startsWith("flags/")) {
      const iso = img.slice("flags/".length).replace(".png", "").toLowerCase();
      return getFlagSource(iso);
    }
    // Remote images
    if (/^https?:\/\//i.test(img)) return { uri: img };
  }

  return undefined;
}

/** Ensure prompts and images are normalized for runtime */
function normalize(items: any[]): Question[] {
  return items.map((q) => {
    // fill prompt by kind if missing
    let prompt: string | undefined = q.prompt;
    if (!prompt) {
      if (q.kind === "country") {
        prompt = `Where is ${q.name}?`;
      } else if (q.kind === "city") {
        const suffix = q.country ? `, ${q.country}` : "";
        prompt = `Where is ${q.name}${suffix}?`;
      } else if (q.kind === "flag") {
        prompt = "FLAG: Which country?";
      } else if (q.kind === "image") {
        prompt = "Where is this?";
      }
    }

    const image = resolveImage(q.image);
    return { ...q, prompt, image } as Question;
  });
}

/**
 * Local-only loader.
 * Reads from the bundled JSON and returns normalized questions.
 */
export async function loadQuestions(): Promise<Question[]> {
  const items = Array.isArray(localData)
    ? (localData as any[])
    : (localData as any)?.items ?? [];
  return normalize(items);
}