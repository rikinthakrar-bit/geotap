// lib/questions.ts
// Pure types + a tiny fallback. No React imports here.

export type PointQuestion = QuestionBase & {
  id: string;
  type: "point";
  prompt: string;
  target: { lat: number; lng: number };
  image?: string | number; // number when using require()
};

export type CountryQuestion = QuestionBase & {
  id: string;
  type: "country";
  prompt: string;
  featureId: string; // Full country NAME (e.g. "France")
  image?: string | number;
};

export type StateQuestion = QuestionBase & {
  id: string;
  type: "state";
  prompt: string;
  featureId: string; // Full state NAME (e.g. "Texas")
  image?: string | number;
};

export type ImageQuestion = QuestionBase & {
  id: string;
  type: "image"; // large image; answer is a point
  prompt?: string;
  target: { lat: number; lng: number };
  image: string | number;
};

export type FlagQuestion = QuestionBase & {
  id: string;
  type: "flag"; // country polygon; small flag chip in header
  prompt?: string;
  featureId: string; // e.g. "Japan"
  image: string | number;
};

export type Question =
  | PointQuestion
  | CountryQuestion
  | StateQuestion
  | ImageQuestion
  | FlagQuestion;

// Minimal bundled fallback (used ONLY if remote + cache both fail).
export const fallbackQuestions: Question[] = [
  {
    id: "louvre",
    type: "image",
    prompt: "Where is this landmark?",
    target: { lat: 48.8606, lng: 2.3376 },
    image: "local:landmarks/louvre.jpg",
  },
  {
    id: "flag-japan",
    type: "flag",
    prompt: "Which country is this flag from?",
    featureId: "Japan",
    image: "local:flags/japan.png",
  },
  { id: "cairo", type: "point", prompt: "Tap Cairo", target: { lat: 30.0444, lng: 31.2357 } },
  { id: "france", type: "country", prompt: "Tap France", featureId: "France" },
];

export interface QuestionBase {
  id: string;
  type: "point" | "country" | "state" | "image" | "flag";
  prompt?: string;
  region?: string; // e.g. "Europe", "Asia", "World"
  difficulty?: "easy" | "medium" | "hard";
}