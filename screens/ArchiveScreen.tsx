// screens/ArchiveScreen.tsx
import { router, type Href } from "expo-router";
import React, { useMemo } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

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
  const days = useMemo(() => isoDaysBack(30), []);

  return (
    <View style={{ flex: 1, backgroundColor: "#F9F9FB", padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>🗓️ Archive</Text>
      <Text style={{ color: "#6B6B6B", marginBottom: 12 }}>
        Play previous daily challenges or view leaderboards.
      </Text>

      <FlatList
        data={days}
        keyExtractor={(d) => d}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item: dateISO }) => (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: "#EAEAEA",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 6 }}>
              {formatDate(dateISO)}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() =>
                  router.push(
                    (`/question?mode=archive&date=${encodeURIComponent(dateISO)}` as Href)
                  )
                }
                style={{
                  backgroundColor: "#007AFF",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Play</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  router.push((`/leaderboard?date=${encodeURIComponent(dateISO)}` as Href))
                }
                style={{
                  backgroundColor: "#fff",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#E0E0E0",
                }}
              >
                <Text style={{ color: "#111", fontWeight: "600" }}>Leaderboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: "#6B6B6B", textAlign: "center", marginTop: 24 }}>
            No archive days available.
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}