// app/(tabs)/summary.tsx
import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Share, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadSummary } from "../../lib/storage";

function formatUkDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatUkDayMonth(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

import * as Storage from "../../lib/storage";

// Fallbacks in case the module shape differs in dev
const todayISO = (Storage as any)?.todayISO ?? (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
});
const updateStreakFor = (Storage as any)?.updateStreakFor ?? (async () => 0);

export default function Summary() {
  // ✅ Read all params (including room) INSIDE the component
  const { totalKm, results, date, room } = useLocalSearchParams<{
    totalKm?: string;
    results?: string;
    date?: string;
    room?: string;
  }>();

  const dateISO = typeof date === "string" && date ? date : todayISO();
  const datePretty = formatUkDate(dateISO);
  const isToday = dateISO === todayISO();
  const headerTitle = isToday ? "Your Daily 10 summary" : `Daily 10 summary - ${formatUkDayMonth(dateISO)}`;
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions?.({
      headerShown: true,
      headerTitle,
      headerBackTitle: "Back",
      headerTintColor: "#fff",
      headerStyle: { backgroundColor: "#0c1320" },
    });
  }, [navigation, headerTitle]);
  // Stored summary (fallback when URL params are missing)
  const [storedTotal, setStoredTotal] = useState<number | undefined>(undefined);
  const [storedItems, setStoredItems] = useState<Array<{ id: string; prompt: string; km: number }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSummary(dateISO);
        if (s) {
          setStoredTotal(s.totalKm);
          setStoredItems(s.items || []);
        }
      } catch {}
    })();
  }, [dateISO]);

  const total = totalKm ? Number(totalKm) : storedTotal;
  const roomId = typeof room === "string" && room ? room : undefined;

  // Parse per-question results, fallback to stored items if results param is missing
  const items = useMemo(() => {
    try {
      if (results) {
        const json = decodeURIComponent(results);
        const parsed = JSON.parse(json);
        return Array.isArray(parsed)
          ? (parsed as Array<{ id: string; prompt: string; km: number }>)
          : (storedItems || []);
      }
      return storedItems || [];
    } catch {
      return storedItems || [];
    }
  }, [results, storedItems]);

  // Maintain streak if this was today's run
  useEffect(() => {
    if (dateISO === todayISO()) updateStreakFor(dateISO).catch(() => {});
  }, [dateISO]);

  // Share message
  const shareText = useMemo(() => {
    const lines = [
      `GeoTap — ${dateISO} total: ${total?.toLocaleString()} km`,
      ``,
      ...items.map(
        (it, idx) =>
          `${String(idx + 1).padStart(2, "0")}. ${it.km.toLocaleString()} km — ${it.prompt}`
      ),
      ``,
      `Can you beat me?`,
    ];
    return lines.join("\n");
  }, [items, total, dateISO]);

  const onShare = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {}
  };

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: "#0c1320" }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ padding: 8, paddingTop: 0, paddingBottom: 12, gap: 16 }}>
        <View style={{ backgroundColor: "#0f172a", borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: "#111827" }}>
          <Text style={{ color: "#9aa4b2", fontSize: 12, marginBottom: 6 }}>{datePretty}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}>
            <Text style={{ fontSize: 30, fontWeight: "900", color: "#ffffff" }}>
              {total !== undefined ? total.toLocaleString() : "—"}
            </Text>
            <Text style={{ color: "#e5e7eb", fontSize: 18, marginLeft: 6 }}>km</Text>
            <Text style={{ color: "#a78bfa", fontSize: 13, marginLeft: 10, fontWeight: "700" }}>distance away</Text>
          </View>

          <View style={{ height: 10 }} />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push(`/leaderboard?date=${dateISO}` as Href)}
              style={{ flex: 1, backgroundColor: "#1F6FEB", paddingVertical: 12, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>Leaderboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={onShare}
              style={{ flex: 1, backgroundColor: "#0b5b2e", paddingVertical: 12, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ backgroundColor: "#0b1220", borderRadius: 12, padding: 0, marginBottom: 16, borderWidth: 1, borderColor: "#111827", overflow: "hidden" }}>
          <View style={{ backgroundColor: "#0c162c", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: "#0f1a33" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#e5e7eb" }}>Round breakdown</Text>
          </View>
          {/* Table header */}
          <View style={{ flexDirection: "row", backgroundColor: "#0d1b34", paddingVertical: 8, paddingHorizontal: 12 }}>
            <Text style={{ width: 48, fontWeight: "700", color: "#cbd5e1" }}>#</Text>
            <Text style={{ flex: 1, fontWeight: "700", color: "#cbd5e1" }}>Question</Text>
            <Text style={{ width: 96, textAlign: "right", fontWeight: "700", color: "#cbd5e1" }}>Score</Text>
          </View>
          {/* Rows */}
          {items.length > 0 ? (
            items.map((it, idx) => (
              <View
                key={it.id ?? idx}
                style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderColor: "#eef2f7", alignItems: "center", backgroundColor: idx % 2 === 0 ? "#0a1428" : "#0c182f" }}
              >
                <Text style={{ width: 48, color: "#9aa4b2" }}>{String(idx + 1).padStart(2, "0")}</Text>
                <Text style={{ flex: 1, color: "#e5e7eb" }}>{it.prompt}</Text>
                <Text style={{ width: 96, textAlign: "right", fontWeight: "700", color: "#e5e7eb" }}>{it.km.toLocaleString()} km</Text>
              </View>
            ))
          ) : (
            <View style={{ padding: 12 }}>
              <Text style={{ opacity: 0.7 }}>No per-question results found.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}