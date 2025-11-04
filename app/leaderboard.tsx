import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { todayISO } from "../lib/daily";
import { getLeaderboard } from "../lib/lbStore";
import { fetchProfiles } from "../lib/profile";

export default function Leaderboard() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateISO = (typeof date === "string" && date) ? date : todayISO();
  const [rows, setRows] = useState<Array<{ id: string; totalKm: number; ts: number }>>([]);
  const [nameMap, setNameMap] = useState<Record<string, { name: string }>>({});

  useEffect(() => {
    (async () => {
      const lb = await getLeaderboard(dateISO);
      setRows(lb);
      const ids = lb.map(r => (r as any).device_id).filter(Boolean);
      if (ids.length) {
        const fetched = await fetchProfiles(ids);
        setNameMap(fetched);
      }
    })();
  }, [dateISO]);

  return (
    <ScrollView contentContainerStyle={{ padding: 24, backgroundColor: "#fff", flexGrow: 1 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>
        Leaderboard — {dateISO}
      </Text>

      {rows.length === 0 ? (
        <Text style={{ opacity: 0.7 }}>No entries yet.</Text>
      ) : (
        rows.map((r, idx) => (
          <View
            key={r.id}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderColor: "#f0f0f0",
            }}
          >
            <Text style={{ fontSize: 16, width: 28 }}>{idx + 1}.</Text>
            <Text style={{ fontSize: 16, flex: 1 }}>
              {nameMap[(r as any).device_id]?.name || "Player"}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700" }}>
              {r.totalKm.toLocaleString()} km
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}