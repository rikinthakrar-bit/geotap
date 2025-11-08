import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAttempts } from "../../lib/attempts";
import { getStats } from "../../lib/lbStore";
import { getChallengeCounts, migrateDailyResultsFromLeaderboards } from "../../lib/storage";

const num = (v: any) => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
};

// Normalise stored distances to km and tame outliers
function normaliseKm(v: any): number {
  const n = num(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  // Heuristic: if value looks like meters (e.g. > 100k), convert to km
  if (n > 100_000) return Math.round(n / 1000);
  // Cap at a plausible max per question (earth half-circumference ~20,000km)
  return Math.min(n, 20_000);
}

function dateFromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function longestStreak(datesISO: string[]): number {
  if (!datesISO.length) return 0;
  const set = new Set(datesISO);
  let best = 0;
  for (const iso of set) {
    const d = dateFromISO(iso);
    const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    const prevISO = prev.toISOString().slice(0, 10);
    if (!set.has(prevISO)) {
      let length = 1;
      let cur = d;
      while (true) {
        const next = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
        const nextISO = next.toISOString().slice(0, 10);
        if (set.has(nextISO)) { length += 1; cur = next; } else { break; }
      }
      if (length > best) best = length;
    }
  }
  return best;
}

export default function StatsScreen() {
  const [loading, setLoading] = useState(true);
  const [plays, setPlays] = useState(0);
  const [avgKm, setAvgKm] = useState(0);
  const [bestKm, setBestKm] = useState(0);
  const [streak, setStreak] = useState(0);

  const [refreshing, setRefreshing] = useState(false);

  const [challengeCounts, setChallengeCounts] = useState<Record<string, number>>({});
  const [avgByKind, setAvgByKind] = useState<Record<string, number>>({});
  const [avgByRegion, setAvgByRegion] = useState<Record<string, number>>({});

  // Ensure foreground notifications show an alert (updated API)
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  const testLocalNotification = async () => {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let status = existing;
      if (existing !== "granted") {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== "granted") {
        console.warn("Notifications permission not granted");
        return;
      }
          await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test notification 🧪",
        body: "This is a local test from GeoTap!",
        sound: "default",
      },
      trigger: null,
    });
    } catch (e) {
      console.warn("Failed to present local notification", e);
    }
  };

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const s: any = await getStats();
      // Expecting shape like: { plays: number, avg: number, best: number, streak: number }
      setPlays(Number.isFinite(s?.plays) ? s.plays : 0);
      setAvgKm(Number.isFinite(s?.avg) ? Math.round(s.avg) : 0);
      setBestKm(Number.isFinite(s?.best) ? Math.round(s.best) : 0);
      setStreak(Number.isFinite(s?.streak) ? s.streak : 0);

      // Challenge completion counts
      try {
        const cc = await getChallengeCounts();
        setChallengeCounts(cc || {});
      } catch {}

      // Overall averages by kind and by region (from per-question attempts across ALL modes)
      try {
        const atts: any[] = (await getAttempts()) || [];

        type Agg = { total: number; n: number };
        const byKind: Record<string, Agg> = {};
        const byRegion: Record<string, Agg> = {};

        // Pretty-print known regions; fallback to Title Case
        const prettyRegion = (r?: string) => {
          const s = String(r ?? "").toLowerCase().replace(/_/g, " ").trim();
          const map: Record<string, string> = {
            "africa": "Africa",
            "asia": "Asia",
            "europe": "Europe",
            "north america": "North America",
            "south america": "South America",
            "oceania": "Oceania",
            "australia": "Oceania",
          };
          if (map[s]) return map[s];
          if (!s) return "Unknown";
          return s.replace(/\b\w/g, (c) => c.toUpperCase());
        };

        // Normalise kind to the keys used by the UI cards
        const normKind = (k?: string, id?: string) => {
          const s = String(k ?? "").toLowerCase();
          if (s.includes("capital")) return "capital";
          if (s.includes("country")) return "country";
          if (s.includes("city")) return "city";
          if (s.includes("flag")) return "flag";
          const idStr = String(id ?? "");
          if (idStr.startsWith("capital:")) return "capital";
          if (idStr.startsWith("flag:")) return "flag";
          if (idStr.startsWith("city:")) return "city";
          if (idStr.startsWith("country:")) return "country";
          return "other";
        };

        for (const a of atts) {
          const km = normaliseKm((a as any)?.correctKm);
          const kindKey = normKind((a as any)?.kind, (a as any)?.metaId);
          const regionKey = prettyRegion((a as any)?.region);

          if (!byKind[kindKey]) byKind[kindKey] = { total: 0, n: 0 };
          byKind[kindKey].total += km;
          byKind[kindKey].n += 1;

          if (!byRegion[regionKey]) byRegion[regionKey] = { total: 0, n: 0 };
          byRegion[regionKey].total += km;
          byRegion[regionKey].n += 1;
        }

        const avgK: Record<string, number> = {};
        Object.keys(byKind).forEach((k) => {
          const e = byKind[k];
          avgK[k] = e.n ? Math.round(e.total / e.n) : 0;
        });
        const avgR: Record<string, number> = {};
        Object.keys(byRegion).forEach((r) => {
          const e = byRegion[r];
          avgR[r] = e.n ? Math.round(e.total / e.n) : 0;
        });

        setAvgByKind(avgK);
        setAvgByRegion(avgR);
      } catch {}
    } catch {
      setPlays(0);
      setAvgKm(0);
      setBestKm(0);
      setStreak(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  useEffect(() => {
    (async () => {
      try {
        await migrateDailyResultsFromLeaderboards();
      } catch {}
      await loadStats();
    })();
  }, [loadStats]);

  useFocusEffect(
    useCallback(() => {
      // Refresh stats whenever this tab/screen gains focus
      loadStats();
      return () => {};
    }, [loadStats])
  );

  const stats = useMemo(() => [
    { icon: "repeat-outline", label: "Plays", value: String(plays), tint: "#3B82F6" },
    { icon: "navigate-outline", label: "Average Score", value: `${avgKm.toLocaleString()} km`, tint: "#10B981" },
    { icon: "trophy-outline", label: "Best Score", value: `${bestKm.toLocaleString()} km`, tint: "#F59E0B" },
    { icon: "flame-outline", label: "Longest Streak", value: `${streak} day${streak === 1 ? "" : "s"}`, tint: "#EF4444" },
  ], [plays, avgKm, bestKm, streak]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Daily 10 stats (existing) */}
        <Text style={styles.heading}>Your Daily 10 Stats</Text>
        <View style={styles.grid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: s.tint + "33" }]}> 
                <Ionicons name={s.icon as any} size={26} color={s.tint} />
              </View>
              <Text style={styles.value}>{loading ? "—" : s.value}</Text>
              <Text style={styles.label}>{s.label}</Text>
            </View>
          ))}
        </View>
        <View style={{ height: 60 }} />

        {/* Overall stats */}
        <Text style={styles.heading}>Overall Averages (per question)</Text>
        <View style={styles.grid}>
          {[
            { label: "Countries", key: "country" },
            { label: "Capitals", key: "capital" },
            { label: "Cities", key: "city" },
            { label: "Flags", key: "flag" },
          ].map((row) => (
            <View key={row.key} style={styles.cardSmall}>
              <Text style={styles.value}>{(avgByKind[row.key] ?? 0).toLocaleString()} km</Text>
              <Text style={styles.label}>{row.label}</Text>
            </View>
          ))}
        </View>

        {/* Regions table */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Average by Region</Text>
          {[
            "Africa",
            "Asia",
            "Europe",
            "North America",
            "South America",
            "Oceania",
          ].map((r) => (
            <View key={r} style={styles.row}>
              <Text style={styles.rowLabel}>{r}</Text>
              <Text style={styles.rowValue}>{(avgByRegion[r] ?? 0).toLocaleString()} km</Text>
            </View>
          ))}
        </View>

        {/* Challenge stats */}
        <Text style={styles.heading}>Challenge Progress</Text>
        <View style={styles.grid}>
          {[1, 2, 3, 4, 5, 6].map((lvl) => (
            <View key={lvl} style={styles.cardSmall}>
              <Text style={styles.value}>{(challengeCounts[String(lvl)] ?? 0).toLocaleString()}</Text>
              <Text style={styles.label}>Level {lvl}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 20, alignItems: "center" }}>
          <Text
            onPress={testLocalNotification}
            style={{
              color: "#1E90FF",
              fontSize: 16,
              fontWeight: "700",
              padding: 12,
              backgroundColor: "#111827",
              borderRadius: 8,
            }}
          >
            Send Test Notification
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0c1320" },
  content: { padding: 16, paddingBottom: 24 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 12,
  },
  iconWrap: { borderRadius: 32, padding: 8, marginBottom: 10 },
  value: { color: "#fff", fontSize: 20, fontWeight: "800" },
  label: { color: "#9aa", fontSize: 13, marginTop: 4 },
  panel: { backgroundColor: "#0b1220", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#111827", marginBottom: 12 },
  panelTitle: { color: "#e5e7eb", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderColor: "#0f1a33" },
  rowLabel: { color: "#cbd5e1" },
  rowValue: { color: "#e5e7eb", fontWeight: "700" },
  cardSmall: {
    width: "48%",
    backgroundColor: "#101828",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },
});
