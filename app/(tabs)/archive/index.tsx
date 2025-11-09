import { trackEvent } from "@/lib/analytics";
import { router, Stack, type Href } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function isoDaysBack(count: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().split("T")[0]); // yyyy-mm-dd
  }
  return out;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ArchiveScreen() {
  // Header: proper title and no back button
  const header = (
    <Stack.Screen
      options={{
        headerTitle: "Archived Daily 10s",
        headerBackVisible: false,
      }}
    />
  );
  const days = useMemo(() => {
    const all = isoDaysBack(30);
    const todayISO = new Date().toISOString().split("T")[0];
    return all.filter((d) => d !== todayISO);
  }, []);

  useEffect(() => {
    // Standard analytics: screen view + list impression
    trackEvent("screen_view", { screen: "archive", surface: "tab" });
    trackEvent("archive_list_impression", { count: Array.isArray(days) ? days.length : 0 });
  }, [days]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }}>
      {header}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 8, color: "#F8FAFC" }}>🗓️ Archived Daily 10s</Text>
        <Text style={{ color: "#CBD5E1", marginBottom: 12, fontWeight: "500" }}>
          Play previous Daily 10s or view leaderboards.
        </Text>

        <FlatList
          data={days}
          keyExtractor={(d) => d}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item: dateISO }) => (
            <View
              style={{
                backgroundColor: "#1E293B",
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: "#334155",
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 8, color: "#F8FAFC" }}>
                Daily 10 — {formatDate(dateISO)}
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    trackEvent("tap_archive_play", { dateISO, surface: "archive_list" });
                    router.push((`/question?mode=archive&date=${encodeURIComponent(dateISO)}` as Href));
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: "#3B82F6",
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Play</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    trackEvent("tap_archive_leaderboard", { dateISO, surface: "archive_list" });
                    router.push((`/leaderboard?date=${encodeURIComponent(dateISO)}` as Href));
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: "#334155",
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#F8FAFC", fontWeight: "600" }}>Leaderboard</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={{ color: "#94A3B8", textAlign: "center", marginTop: 24, fontWeight: "500" }}>
              No archive days available.
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>
    </SafeAreaView>
  );
}
