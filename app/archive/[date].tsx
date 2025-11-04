import { router, useLocalSearchParams, type Href } from "expo-router";
import { Button, Text, View } from "react-native";

export default function ArchiveDay() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateISO = (typeof date === "string" && date) ? date : "";

  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: "#fff", justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 16 }}>
        Archive — {dateISO || "Unknown date"}
      </Text>

      <View style={{ gap: 12 }}>
        <Button title="View Leaderboard" onPress={() => router.push(`/leaderboard?date=${dateISO}` as Href)} />
        <Button title="Play This Set" onPress={() => router.push(`/question?mode=archive&date=${dateISO}` as Href)} />
        <Button title="Back" onPress={() => router.back()} />
      </View>
    </View>
  );
}