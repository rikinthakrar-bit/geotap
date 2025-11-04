import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_STREAK_COUNT = "streak.count";
const KEY_STREAK_LAST = "streak.lastDateISO";

// YYYY-MM-DD in local time
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function updateStreakFor(dateISO: string): Promise<number> {
  try {
    const [last, countRaw] = await Promise.all([
      AsyncStorage.getItem(KEY_STREAK_LAST),
      AsyncStorage.getItem(KEY_STREAK_COUNT),
    ]);
    const prevCount = countRaw ? parseInt(countRaw, 10) : 0;
    if (last === dateISO) return prevCount || 1;

    const d = new Date(dateISO + "T00:00:00");
    const yest = new Date(d);
    yest.setDate(d.getDate() - 1);
    const yISO = yest.toISOString().slice(0, 10);

    let next = 1;
    if (last === yISO && prevCount > 0) next = prevCount + 1;

    await AsyncStorage.multiSet([
      [KEY_STREAK_LAST, dateISO],
      [KEY_STREAK_COUNT, String(next)],
    ]);
    return next;
  } catch {
    return 1;
  }
}

export async function getStreak(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_STREAK_COUNT);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}