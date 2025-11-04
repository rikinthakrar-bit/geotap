// app/summary.tsx
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo } from "react";
import { Button, ScrollView, Share, Text, View } from "react-native";
//import { recordMyScore } from "../lib/friends-challenge";
import { todayISO, updateStreakFor } from "../lib/storage";

export default function Summary() {
  // ✅ Read all params (including room) INSIDE the component
  const { totalKm, results, date, room } = useLocalSearchParams<{
    totalKm?: string;
    results?: string;
    date?: string;
    room?: string;
  }>();

  const dateISO = typeof date === "string" && date ? date : todayISO();
  const total = totalKm ? Number(totalKm) : undefined;
  const roomId = typeof room === "string" && room ? room : undefined;

  // Parse per-question results
  const items = useMemo(() => {
    try {
      if (!results) return [];
      const json = decodeURIComponent(results);
      const parsed = JSON.parse(json);
      return Array.isArray(parsed)
        ? (parsed as Array<{ id: string; prompt: string; km: number }>)
        : [];
    } catch {
      return [];
    }
  }, [results]);

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
    <ScrollView contentContainerStyle={{ padding: 24, backgroundColor: "#fff", flexGrow: 1 }}>
      <Text style={{ fontSize: 26, fontWeight: "700", marginBottom: 6 }}>
        Daily Challenge Complete — {dateISO}
      </Text>

      <Text style={{ fontSize: 16, opacity: 0.8, marginBottom: 16 }}>
        {total !== undefined
          ? `Your total distance: ${total.toLocaleString()} km`
          : "No total recorded"}
      </Text>

      <View style={{ borderTopWidth: 1, borderColor: "#eee", paddingTop: 12, marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
          Round breakdown
        </Text>
        {items.length > 0 ? (
          items.map((it, idx) => (
            <View
              key={it.id ?? idx}
              style={{
                paddingVertical: 10,
                borderBottomWidth: idx === items.length - 1 ? 0 : 1,
                borderColor: "#f0f0f0",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 15, maxWidth: "70%" }}>
                {idx + 1}. {it.prompt}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "600" }}>
                {it.km.toLocaleString()} km
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ opacity: 0.7 }}>No per-question results found.</Text>
        )}
      </View>

      <View style={{ gap: 12 }}>
        <Button title="Share Results" onPress={onShare} />
        <Button
          title="View Leaderboard for this Day"
          onPress={() => router.push(`/leaderboard?date=${dateISO}` as Href)}
        />
        {roomId ? (
          <Button
            title="View Challenge Room"
            onPress={() => router.push(`/challenge/${roomId}` as Href)}
          />
        ) : null}
        <Button
          title="Play Another Day"
          onPress={() => router.replace("/archive" as Href)}
        />
      </View>
    </ScrollView>
  );
}