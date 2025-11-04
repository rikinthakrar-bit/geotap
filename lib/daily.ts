// lib/daily.ts
import type { Question } from "./questions";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10); // e.g. "2025-10-28"
}

export function getDailySet(all: Question[], dateISO: string, total = 10) {
  const rng = mulberry32(hashCode(dateISO));

  const easy = all.filter(q => q.difficulty === "easy");
  const med = all.filter(q => q.difficulty === "medium");
  const hard = all.filter(q => q.difficulty === "hard");

  // helper: shuffle array in place
  const shuffle = <T>(arr: T[]) => arr.sort(() => rng() - 0.5);

  const selected = [
    ...shuffle(easy).slice(0, 4),
    ...shuffle(med).slice(0, 4),
    ...shuffle(hard).slice(0, 2),
  ];

  // if there aren't enough, fill from others
  while (selected.length < total) {
    const pool = shuffle(all);
    selected.push(pool[selected.length % pool.length]);
  }

  return shuffle(selected);
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