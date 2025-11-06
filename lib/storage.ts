import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "daily_results_v1"; // same key used by addResult

type LBEntry = {
  id: string;
  totalKm: number;
  ts: number;
};

function keyFor(dateISO: string): string {
  return `lb.${dateISO}`;
}

export async function getLeaderboard(dateISO: string): Promise<LBEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(dateISO));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addResult(dateISO: string, totalKm: number): Promise<LBEntry[]> {
  const id = `run_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const entry: LBEntry = { id, totalKm, ts: Date.now() };

  // 1) Update per-day leaderboard (lb.<date>)
  const list = await getLeaderboard(dateISO);
  const next = [...list, entry].sort((a, b) => (a.totalKm - b.totalKm) || (a.ts - b.ts));
  await AsyncStorage.setItem(keyFor(dateISO), JSON.stringify(next));

  // 2) Update aggregate daily results map used by Stats (KEY = daily_results_v1)
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const prev = map[dateISO];
    // Keep the **best** score (lowest km) for that day
    map[dateISO] = typeof prev === "number" ? Math.min(prev, totalKm) : totalKm;
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // fail-safe: do nothing if aggregate write fails
  }

  return next;
}

const MIGRATION_FLAG = "daily_results_v1:migrated";

/**
 * One-time (idempotent) migration: scan all `lb.<date>` keys, take the best (lowest) totalKm
 * per day, and merge into the aggregate map stored under KEY = `daily_results_v1`.
 * Safe to run multiple times; it always keeps the minimum (best) per date.
 * Returns the number of leaderboard days it scanned.
 */
export async function migrateDailyResultsFromLeaderboards(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const lbKeys = keys.filter((k) => k.startsWith("lb."));

    // Load existing aggregate map (if any)
    const rawMap = await AsyncStorage.getItem(KEY);
    const map: Record<string, number> = rawMap ? JSON.parse(rawMap) : {};

    for (const k of lbKeys) {
      const dateISO = k.slice(3); // remove "lb."
      try {
        const raw = await AsyncStorage.getItem(k);
        const list: LBEntry[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list) || list.length === 0) continue;
        const bestForDay = list.reduce((min, e) => (e.totalKm < min ? e.totalKm : min), Infinity);
        if (Number.isFinite(bestForDay)) {
          const prev = map[dateISO];
          map[dateISO] = typeof prev === "number" ? Math.min(prev, bestForDay as number) : (bestForDay as number);
        }
      } catch {
        // ignore corrupt day
      }
    }

    await AsyncStorage.setItem(KEY, JSON.stringify(map));
    // Mark migrated (best-effort) so you can skip next time if you want
    await AsyncStorage.setItem(MIGRATION_FLAG, "1");
    return lbKeys.length;
  } catch {
    return 0;
  }
}

// ---- Daily Summary persistence ----
export type SummaryItem = { id: string; prompt: string; km: number };
const KEY_SUMMARY_PREFIX = "summary."; // e.g., summary.2025-11-04

export async function saveSummary(
  dateISO: string,
  totalKm: number,
  items: SummaryItem[]
): Promise<void> {
  try {
    const payload = { totalKm, items };
    await AsyncStorage.setItem(KEY_SUMMARY_PREFIX + dateISO, JSON.stringify(payload));
  } catch {}
}

export async function loadSummary(
  dateISO: string
): Promise<{ totalKm: number; items: SummaryItem[] } | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SUMMARY_PREFIX + dateISO);
    if (!raw) return null;
    const obj = JSON.parse(raw) as { totalKm?: number; items?: SummaryItem[] };
    return {
      totalKm: Number(obj?.totalKm) || 0,
      items: Array.isArray(obj?.items) ? obj.items! : [],
    };
  } catch {
    return null;
  }
}

// ---- Summary index helpers ----
export async function listSummaryDates(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys
      .filter((k) => k.startsWith(KEY_SUMMARY_PREFIX))
      .map((k) => k.substring(KEY_SUMMARY_PREFIX.length))
      .sort();
  } catch {
    return [];
  }
}

export async function getAllSummaries(): Promise<Array<{ date: string; totalKm: number; items: SummaryItem[] }>> {
  try {
    const dates = await listSummaryDates();
    const out: Array<{ date: string; totalKm: number; items: SummaryItem[] }> = [];
    for (const d of dates) {
      const s = await loadSummary(d);
      if (s) out.push({ date: d, totalKm: s.totalKm, items: s.items });
    }
    return out;
  } catch {
    return [];
  }
}


// ---- Challenge counters ----
const KEY_CHALLENGE_COUNTS = "challenge.counts.v1"; // { [level:string]: number }

export async function incrementChallengeLevel(level: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CHALLENGE_COUNTS);
    const obj: Record<string, number> = raw ? JSON.parse(raw) : {};
    const key = String(level);
    obj[key] = (obj[key] ?? 0) + 1;
    await AsyncStorage.setItem(KEY_CHALLENGE_COUNTS, JSON.stringify(obj));
  } catch {}
}

export async function getChallengeCounts(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CHALLENGE_COUNTS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}