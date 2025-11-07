import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);
export type LBEntry = {
  id: string;
  totalKm: number;
  ts: number;
};

const keyFor = (dateISO: string) => `lb.${dateISO}`;

/** Get leaderboard entries sorted by totalKm asc, then timestamp asc. */
export async function getLeaderboard(dateISO?: string) {
  const { data, error } = await supabase
    .from("v_daily_results_with_names")   // 👈 use the view, not the table
    .select("*")
    .eq("date_iso", dateISO)
    .order("total_km", { ascending: true });

  if (error) {
    console.error("[getLeaderboard] error:", error);
    return [];
  }

  return data || [];
}

/** Add a result and return updated, sorted list. */
export async function addResult(dateISO: string, totalKm: number): Promise<LBEntry[]> {
  const id = `run_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const entry: LBEntry = { id, totalKm, ts: Date.now() };
  const list = await getLeaderboard(dateISO);
  const next = [...list, entry];
  await AsyncStorage.setItem(keyFor(dateISO), JSON.stringify(next));
  return next.sort((a, b) => (a.totalKm - b.totalKm) || (a.ts - b.ts));
}

// lib/lbStore.ts
const KEY = "daily_results_v1"; // same key used by addResult

export type DailyResult = { date: string; totalKm: number };

export async function getAllResults(): Promise<DailyResult[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  // stored as { [date]: number }
  const map = JSON.parse(raw) as Record<string, number>;
  return Object.entries(map)
    .map(([date, totalKm]) => ({ date, totalKm }))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
}

export async function getRecentResults(n = 7): Promise<DailyResult[]> {
  const all = await getAllResults();
  return all.slice(0, n);
}

// lib/lbStore.ts (below helpers)
export async function getStats() {
  const all = await getAllResults();
  const plays = all.length;
  const best = plays ? Math.min(...all.map(r => r.totalKm)) : 0; // lower is better
  const avg = plays ? Math.round(all.reduce((s, r) => s + r.totalKm, 0) / plays) : 0;

  // simple streak: consecutive days ending today
  const today = new Date().toISOString().slice(0, 10);
  const set = new Set(all.map(r => r.date));
  let streak = 0;
  let d = new Date(today);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }

  return { plays, best, avg, streak };
}

// Return true if we already have a score stored for the given date
export async function hasPlayed(dateISO: string): Promise<boolean> {
  try {
    const KEY = "daily_results_v1"; // must match your other lbStore functions
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, number>;
    const v = map?.[dateISO];
    return typeof v === "number" && Number.isFinite(v);
  } catch {
    return false;
  }
}