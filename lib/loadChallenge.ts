// lib/loadChallenge.ts
export type LevelRule = {
  id: number;
  difficulty: "easy" | "medium" | "hard";
  numQuestions: number;
  advanceMaxKm: number;
  adAfter?: boolean;
};

type ChallengeFile = {
  version: number;
  levels: LevelRule[];
};

// Using require() so it works without extra TS config
let raw: ChallengeFile;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  raw = require("../assets/challenge.json") as ChallengeFile;
} catch (e) {
  console.warn("challenge.json missing or invalid:", e);
  raw = { version: 1, levels: [] };
}

export async function loadChallenge(): Promise<LevelRule[]> {
  return Array.isArray(raw.levels) ? raw.levels : [];
}