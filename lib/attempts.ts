// lib/attempts.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "attempts_v1";
const MAX = 5000; // cap to avoid unlimited growth

export type Attempt = {
  ts: number;                 // Date.now()
  mode: "daily" | "practice" | "challenge" | "archive";
  topic?: string | null;      // e.g. "region_asia", "countries", etc (for practice)
  kind?: string | null;       // "country" | "capital" | "city" | "flag" | ...
  region?: string | null;     // "asia" | "europe" | "africa" | "americas" | "oceania"
  correctKm?: number | null;  // distance for the question (0 if perfect)
  wasCorrect?: boolean | null;
  metaId?: string | null;     // a stable id if you have one
};

export async function recordAttempt(a: Attempt) {
  try {
    const raw = (await AsyncStorage.getItem(KEY)) || "[]";
    const arr: Attempt[] = JSON.parse(raw);
    arr.push(a);
    if (arr.length > MAX) arr.splice(0, arr.length - MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  } catch {}
}

export async function getAttempts(): Promise<Attempt[]> {
  try {
    const raw = (await AsyncStorage.getItem(KEY)) || "[]";
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function clearAttempts() {
  await AsyncStorage.removeItem(KEY);
}