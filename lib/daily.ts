// lib/daily.ts
import { ensureDaily10Reminder } from "@/lib/notifications";
import type { Question } from "./questions";

export function todayISO(cutoffHour: number = 5): string {
  // Returns the current date in Europe/London, with a daily cutoff at `cutoffHour` (default 05:00).
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find(p => p.type === t)?.value as string | undefined;
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const h = Number(get("hour"));

  // Helper to format a given JS Date into YYYY-MM-DD in Europe/London
  const formatYMD = (date: Date) => {
    const pp = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const yy = pp.find(p => p.type === "year")!.value;
    const mm = pp.find(p => p.type === "month")!.value;
    const dd = pp.find(p => p.type === "day")!.value;
    return `${yy}-${mm}-${dd}`;
  };

  // Build a JS Date representing today 00:00 in London by taking the UTC midnight of the
  // extracted Y-M-D and then formatting back to London with the helper.
  const londonMidnightUTC = new Date(Date.UTC(y, m - 1, d));

  if (!Number.isNaN(h) && h < cutoffHour) {
    // Before cutoff: use previous London day
    const prev = new Date(londonMidnightUTC.getTime() - 24 * 60 * 60 * 1000);
    return formatYMD(prev);
  }

  // On/after cutoff: use current London day
  return formatYMD(londonMidnightUTC);
}

export function getDailySet(all: Question[], dateISO: string, total = 10) {
  // Seeded RNG for deterministic per-day selection
  const rng = mulberry32(hashCode(dateISO));

  // Safe/seeded shuffle (non-mutating)
  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => rng() - 0.5);

  // Flexible helpers to detect topic/kind across schemas
  const isCountry = (q: any) =>
    q?.topic === "countries" || q?.kind === "country" || q?.category === "country";
  const isCapital = (q: any) =>
    q?.topic === "capitals" || q?.kind === "capital" || q?.category === "capital";
  const isCity = (q: any) =>
    q?.topic === "cities" || q?.kind === "city" || q?.category === "city";
  const isFlag = (q: any) =>
    q?.topic === "flags" || q?.kind === "flag" || q?.category === "flag";

  // Difficulty helpers
  const diff = (d: string) => (q: any) => String(q?.difficulty || "").toLowerCase() === d;
  const isEasy = diff("easy");
  const isMed = diff("medium");
  const isHard = diff("hard");

  // Filtered pools
  const countriesEasy = shuffle(all.filter(q => isCountry(q) && isEasy(q)));
  const countriesMed  = shuffle(all.filter(q => isCountry(q) && isMed(q)));
  const countriesHard = shuffle(all.filter(q => isCountry(q) && isHard(q)));

  const capitalsAny   = shuffle(all.filter(q => isCapital(q))); // any difficulty
  const flagsEasyMed  = shuffle(all.filter(q => isFlag(q) && (isEasy(q) || isMed(q))));
  const citiesEasy    = shuffle(all.filter(q => isCity(q) && isEasy(q)));

  // Utility to take N unique items from a pool
  const take = <T,>(pool: T[], n: number) => {
    const out: T[] = [];
    for (let i = 0; i < n && pool.length > 0; i++) out.push(pool.shift() as T);
    return out;
  };

  const selected: Question[] = [
    ...take(countriesEasy, 3),
    ...take(countriesMed, 2),
    ...take(countriesHard, 1),
    ...take(capitalsAny, 2),
    ...take(flagsEasyMed, 1),
    ...take(citiesEasy, 1),
  ];

  // Fallbacks if any bucket ran short (e.g., content gaps):
  // 1) try other difficulties of same topic first
  const backfillOrder: Question[][] = [
    // Countries shortfall: draw from any country pool
    shuffle(all.filter(isCountry)),
    // Capitals shortfall: any capitals
    shuffle(all.filter(isCapital)),
    // Flags shortfall: any flags
    shuffle(all.filter(isFlag)),
    // Cities shortfall: any cities
    shuffle(all.filter(isCity)),
    // Absolute fallback: any question
    shuffle(all),
  ];

  // Ensure 'total' questions
  const need = Math.max(0, total - selected.length);
  if (need > 0) {
    const already = new Set(selected.map((q: any) => q?.id ?? q));
    const pushUnique = (pool: Question[]) => {
      for (const q of pool) {
        const key = (q as any)?.id ?? q as any;
        if (!already.has(key)) {
          selected.push(q);
          already.add(key);
          if (selected.length >= total) break;
        }
      }
    };
    for (const pool of backfillOrder) {
      if (selected.length >= total) break;
      pushUnique(pool);
    }
  }

  // Final seeded shuffle for order variety
  return shuffle(selected).slice(0, total);
}

// same simple seeded RNG you had before
function hashCode(str: string) {
  let h = 0, i = 0, len = str.length;
  while (i < len) h = (h << 5) - h + str.charCodeAt(i++) | 0;
  return h;
}
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Helper to trigger next Daily10 reminder after a successful play
export async function scheduleNextDaily10Reminder() {
  try {
    await ensureDaily10Reminder(true, 18, 0); // they’ve played → schedule tomorrow 6pm
  } catch (e) {
    console.warn("scheduleNextDaily10Reminder failed", e);
  }
}